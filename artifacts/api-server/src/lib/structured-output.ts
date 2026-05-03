export interface StructuredOutputPreset {
  id: string;
  name: string;
  enabled: boolean;
  hidePrefillInDisplay: boolean;
  minCharsAfterPrefix: number;
  newlineToken: string;
  antiSlopBanList: string;
  continueOverlapChars: number;
  overridePrefillEnabled: boolean;
  overridePrefillText: string;
  createdAt: string;
  updatedAt: string;
}

interface ProcessedMessage { role: string; content: string; }

export interface SOBuildResult {
  messages: ProcessedMessage[];
  responseFormat: object;
  hidePrefillLength: number;
  prefillText: string;
}

const EMOTIONS = [
  'happy','sad','angry','nervous','flustered','confused','surprised','tired',
  'bored','excited','content','embarrassed','afraid','hopeful','disgusted',
  'proud','lonely','jealous','calm','determined','guilty','nostalgic','amused',
  'frustrated','disappointed','curious','relieved','shy','worried','melancholy',
  'playful','flirtatious','tense','solemn','wistful','awestruck','smug','bitter',
];

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function resolveSlot(content: string): string | null {
  const lower = content.toLowerCase().trim();
  if (lower === 'end' || lower === 'stop' || lower === 'eos') return null;
  if (lower === 'keep' || lower === 'pg') return '';
  if (lower === 'free') return '[\\s\\S]+?';
  if (lower === 'line') return '[^\\n]+';
  if (lower === 'emotion' || lower === 'mood') return `(?:${EMOTIONS.join('|')})`;
  if (lower === 'action') return '(?:\\S+(?:\\s+\\S+){0,5})';
  if (lower === 'thought') return '(?:\\S+(?:\\s+\\S+){0,9})';
  if (lower === 'name') return '[A-Z][a-z]+(?:\\s+[A-Z][a-z]+)?';

  const linesMatch = lower.match(/^lines?:(\d+)(?:-(\d+))?$/);
  if (linesMatch) {
    const min = parseInt(linesMatch[1]);
    const max = linesMatch[2] ? parseInt(linesMatch[2]) : min;
    if (min === 1 && max === 1) return '[^\\n]+';
    return `(?:[^\\n]+\\n){${min - 1},${max - 1}}[^\\n]+`;
  }

  const wordMatch = lower.match(/^(?:w|words?):(\d+)(?:-(\d+))?$/);
  if (wordMatch) {
    const min = parseInt(wordMatch[1]);
    const max = wordMatch[2] ? parseInt(wordMatch[2]) : min;
    if (min === 1 && !wordMatch[2]) return '\\S+';
    return `(?:\\S+\\s+){${min - 1},${Math.max(min, max) - 1}}\\S+`;
  }

  const optMatch = content.match(/^opt(?:ions?)?:([\s\S]+)$/i);
  if (optMatch) {
    const options = optMatch[1].split('|').map(o => escapeRegex(o.trim())).filter(Boolean);
    return `(?:${options.join('|')})`;
  }

  const reMatch = content.match(/^re:([\s\S]+)$/i);
  if (reMatch) {
    let rx = reMatch[1].trim();
    if (rx.startsWith('/') && rx.lastIndexOf('/') > 0) {
      rx = rx.slice(1, rx.lastIndexOf('/'));
    }
    return rx;
  }

  return escapeRegex(`[[${content}]]`);
}

function buildPatternFromText(text: string, newlineToken: string): {
  pattern: string;
  isFinalStop: boolean;
  hiddenPrefixLength: number;
  prefillLiteralLength: number;
} {
  const SLOT_RE = /\[\[([\s\S]*?)\]\]/g;
  let pattern = '';
  let isFinalStop = false;
  let hiddenPrefixLength = 0;
  let prefillLiteralLength = 0;
  let keepFound = false;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  SLOT_RE.lastIndex = 0;
  while ((match = SLOT_RE.exec(text)) !== null) {
    const literalBefore = text.slice(lastIndex, match.index);
    if (literalBefore) {
      const nl = newlineToken || '\\n';
      const parts = literalBefore.split('\n');
      const escaped = parts.map(p => escapeRegex(p)).join(nl);
      pattern += escaped;
      if (!keepFound) hiddenPrefixLength += literalBefore.length;
      prefillLiteralLength += literalBefore.length;
    }

    const slotContent = match[1];
    const lowerSlot = slotContent.toLowerCase().trim();

    if (lowerSlot === 'keep') {
      keepFound = true;
      lastIndex = match.index + match[0].length;
      continue;
    }

    const resolved = resolveSlot(slotContent);
    if (resolved === null) { isFinalStop = true; break; }
    if (resolved) pattern += resolved;
    lastIndex = match.index + match[0].length;
  }

  if (!isFinalStop) {
    const remaining = text.slice(lastIndex);
    if (remaining) {
      const nl = newlineToken || '\\n';
      const parts = remaining.split('\n');
      const escaped = parts.map(p => escapeRegex(p)).join(nl);
      pattern += escaped;
      prefillLiteralLength += remaining.length;
    }
  }

  if (!keepFound) hiddenPrefixLength = prefillLiteralLength;

  return { pattern, isFinalStop, hiddenPrefixLength, prefillLiteralLength };
}

export function applyStructuredOutput(
  messages: ProcessedMessage[],
  preset: StructuredOutputPreset,
): SOBuildResult | null {
  if (!preset.enabled) return null;
  if (messages.length === 0) return null;

  const lastMsg = messages[messages.length - 1];
  if (lastMsg.role !== 'assistant') return null;

  const rawPrefill = preset.overridePrefillEnabled
    ? preset.overridePrefillText
    : lastMsg.content;

  if (!rawPrefill.trim()) return null;

  const { pattern, isFinalStop, hiddenPrefixLength, prefillLiteralLength } =
    buildPatternFromText(rawPrefill, preset.newlineToken);

  let finalPattern = pattern;

  if (!isFinalStop && preset.minCharsAfterPrefix > 0) {
    finalPattern += `[\\s\\S]{${preset.minCharsAfterPrefix},}`;
  }

  if (preset.antiSlopBanList.trim()) {
    const words = preset.antiSlopBanList
      .split('\n')
      .map(w => w.trim().toLowerCase())
      .filter(Boolean)
      .map(escapeRegex);
    if (words.length > 0) {
      finalPattern = `(?!(?:[\\s\\S]*?)(?:${words.join('|')}))${finalPattern}`;
    }
  }

  const hidePrefillLength = preset.hidePrefillInDisplay ? hiddenPrefixLength : 0;

  const prefillText = rawPrefill.replace(/\[\[[\s\S]*?\]\]/g, '').replace(/\n/g, '\n');

  return {
    messages: messages.slice(0, -1),
    responseFormat: {
      type: 'json_schema',
      json_schema: {
        name: 'structured_output',
        strict: true,
        schema: {
          type: 'object',
          properties: { value: { type: 'string', pattern: finalPattern } },
          required: ['value'],
          additionalProperties: false,
        },
      },
    },
    hidePrefillLength,
    prefillText,
  };
}

export function unwrapSOResponse(rawContent: string, hidePrefillLength: number): string {
  let value = rawContent;
  try {
    const parsed = JSON.parse(rawContent) as Record<string, unknown>;
    if (parsed && typeof parsed.value === 'string') {
      value = parsed.value;
    }
  } catch {
    const match = rawContent.match(/"value"\s*:\s*"([\s\S]*?)"\s*\}?\s*$/);
    if (match) {
      try {
        value = JSON.parse('"' + match[1] + '"') as string;
      } catch {
        value = match[1]
          .replace(/\\n/g, '\n')
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\')
          .replace(/\\t/g, '\t');
      }
    }
  }
  if (hidePrefillLength > 0 && value.length > hidePrefillLength) {
    return value.slice(hidePrefillLength);
  }
  return value;
}

export class SOStreamProcessor {
  private accContent = '';
  private inValue = false;
  private emittedDecoded = 0;
  private totalDecoded = 0;
  readonly hidePrefillLength: number;

  constructor(hidePrefillLength: number) {
    this.hidePrefillLength = hidePrefillLength;
  }

  processContentDelta(delta: string): string {
    this.accContent += delta;

    if (!this.inValue) {
      const valuePrefix = '"value":"';
      const idx = this.accContent.indexOf(valuePrefix);
      if (idx === -1) return '';
      this.inValue = true;
    }

    const valuePrefix = '"value":"';
    const valuePrefixIdx = this.accContent.indexOf(valuePrefix);
    const rawValueStr = this.accContent.slice(valuePrefixIdx + valuePrefix.length);
    const { decoded } = decodeJsonStringPartial(rawValueStr);

    const newDecoded = decoded.slice(this.emittedDecoded);
    this.emittedDecoded = decoded.length;

    if (newDecoded.length === 0) return '';

    const prevTotal = this.totalDecoded;
    this.totalDecoded += newDecoded.length;

    if (this.hidePrefillLength > 0) {
      if (prevTotal >= this.hidePrefillLength) {
        return newDecoded;
      }
      if (this.totalDecoded <= this.hidePrefillLength) {
        return '';
      }
      return newDecoded.slice(this.hidePrefillLength - prevTotal);
    }

    return newDecoded;
  }
}

function decodeJsonStringPartial(raw: string): { decoded: string; closed: boolean } {
  let decoded = '';
  let i = 0;
  let closed = false;

  while (i < raw.length) {
    if (raw[i] === '"') { closed = true; break; }
    if (raw[i] === '\\') {
      if (i + 1 >= raw.length) break;
      const next = raw[i + 1];
      switch (next) {
        case '"': decoded += '"'; i += 2; break;
        case '\\': decoded += '\\'; i += 2; break;
        case '/': decoded += '/'; i += 2; break;
        case 'n': decoded += '\n'; i += 2; break;
        case 'r': decoded += '\r'; i += 2; break;
        case 't': decoded += '\t'; i += 2; break;
        case 'b': decoded += '\b'; i += 2; break;
        case 'f': decoded += '\f'; i += 2; break;
        case 'u':
          if (i + 5 <= raw.length) {
            const hex = raw.slice(i + 2, i + 6);
            if (/^[0-9a-fA-F]{4}$/.test(hex)) {
              decoded += String.fromCharCode(parseInt(hex, 16));
              i += 6;
            } else { decoded += next; i += 2; }
          } else { i = raw.length; }
          break;
        default: decoded += next; i += 2;
      }
    } else {
      decoded += raw[i];
      i++;
    }
  }

  return { decoded, closed };
}
