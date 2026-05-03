export interface ChatVariables {
  local: Map<string, string | number>;
  global: Map<string, string | number>;
}

export interface MacroContext {
  char?: string;
  charDescription?: string;
  charPersonality?: string;
  charScenario?: string;
  charVersion?: string;
  charPrompt?: string;
  charJailbreak?: string;
  charDepthPrompt?: string;
  mesExamples?: string;
  mesExamplesRaw?: string;
  user?: string;
  persona?: string;
  group?: string[];
  groupNotMuted?: string[];
  notChar?: string[];
  lastMessage?: string;
  lastMessageId?: number;
  lastCharMessage?: string;
  lastUserMessage?: string;
  firstIncludedMessageId?: number;
  currentSwipeId?: number;
  lastSwipeId?: number;
  lastGenerationType?: string;
  model?: string;
  input?: string;
  idleDuration?: number;
  variables?: ChatVariables;
  summary?: string;
  authorsNote?: string;
  charAuthorsNote?: string;
  defaultAuthorsNote?: string;
  outlets?: Map<string, string>;
  _usedContentGroups?: Set<string>;
}

export function createDefaultMacroContext(): MacroContext {
  return {
    char: '',
    user: '',
    variables: { local: new Map(), global: new Map() },
    outlets: new Map(),
  };
}

function getCurrentTime(): string { return new Date().toLocaleTimeString(); }
function getCurrentDate(): string { return new Date().toLocaleDateString(); }
function getISOTime(): string { return new Date().toTimeString().slice(0, 5); }
function getISODate(): string { return new Date().toISOString().split('T')[0]; }
function getWeekday(): string { return new Date().toLocaleDateString('en-US', { weekday: 'long' }); }

function getTimeWithOffset(offset: number): string {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (3600000 * offset)).toLocaleTimeString();
}

function formatDateTime(format: string): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return format
    .replace(/YYYY/g, now.getFullYear().toString())
    .replace(/YY/g, now.getFullYear().toString().slice(-2))
    .replace(/MM/g, pad(now.getMonth() + 1))
    .replace(/DD/g, pad(now.getDate()))
    .replace(/HH/g, pad(now.getHours()))
    .replace(/hh/g, pad(now.getHours() % 12 || 12))
    .replace(/mm/g, pad(now.getMinutes()))
    .replace(/ss/g, pad(now.getSeconds()))
    .replace(/A/g, now.getHours() >= 12 ? 'PM' : 'AM')
    .replace(/a/g, now.getHours() >= 12 ? 'pm' : 'am')
    .replace(/MMMM/g, now.toLocaleDateString('en-US', { month: 'long' }))
    .replace(/MMM/g, now.toLocaleDateString('en-US', { month: 'short' }))
    .replace(/dddd/g, now.toLocaleDateString('en-US', { weekday: 'long' }))
    .replace(/ddd/g, now.toLocaleDateString('en-US', { weekday: 'short' }));
}

function humanizeDuration(ms: number): string {
  const s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (d > 0) return `${d} day${d > 1 ? 's' : ''}`;
  if (h > 0) return `${h} hour${h > 1 ? 's' : ''}`;
  if (m > 0) return `${m} minute${m > 1 ? 's' : ''}`;
  return `${s} second${s !== 1 ? 's' : ''}`;
}

function processRandom(args: string): string {
  const items = args.split(',').map(s => s.trim());
  return items[Math.floor(Math.random() * items.length)] || '';
}

function processRandomAlt(args: string): string {
  const items = args.split('::').map(s => s.trim());
  return items[Math.floor(Math.random() * items.length)] || '';
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return hash;
}

function processPick(args: string, sourceHash: number): string {
  const items = args.split('::').map(s => s.trim());
  return items[Math.abs(sourceHash) % items.length] || '';
}

function processRoll(formula: string): string {
  const match = formula.match(/^(\d*)d(\d+)([+-]\d+)?$/i);
  if (!match) return formula;
  const count = match[1] ? parseInt(match[1]) : 1;
  const sides = parseInt(match[2]);
  const modifier = match[3] ? parseInt(match[3]) : 0;
  let total = modifier;
  for (let i = 0; i < count; i++) total += Math.floor(Math.random() * sides) + 1;
  return total.toString();
}

function getVar(variables: ChatVariables | undefined, name: string, isGlobal: boolean): string {
  if (!variables) return '';
  const v = (isGlobal ? variables.global : variables.local).get(name);
  return v !== undefined ? String(v) : '';
}

function setVar(variables: ChatVariables | undefined, name: string, value: string, isGlobal: boolean): string {
  if (!variables) return '';
  (isGlobal ? variables.global : variables.local).set(name, value);
  return '';
}

function addVar(variables: ChatVariables | undefined, name: string, increment: string, isGlobal: boolean): string {
  if (!variables) return '';
  const map = isGlobal ? variables.global : variables.local;
  map.set(name, (Number(map.get(name)) || 0) + (Number(increment) || 0));
  return '';
}

function incVar(variables: ChatVariables | undefined, name: string, isGlobal: boolean): string {
  if (!variables) return '';
  const map = isGlobal ? variables.global : variables.local;
  const v = (Number(map.get(name)) || 0) + 1;
  map.set(name, v);
  return v.toString();
}

function decVar(variables: ChatVariables | undefined, name: string, isGlobal: boolean): string {
  if (!variables) return '';
  const map = isGlobal ? variables.global : variables.local;
  const v = (Number(map.get(name)) || 0) - 1;
  map.set(name, v);
  return v.toString();
}

export function processMacros(content: string, context: MacroContext = {}): string {
  if (!content) return content;
  let result = content;
  const sourceHash = hashString(content);

  result = result.replace(/\{\{([^{}]+)\}\}/gi, (match, inner) => {
    const macroContent = inner.trim();
    const macroLower = macroContent.toLowerCase();

    if (macroLower.startsWith('//')) return '';
    if (macroLower === 'pipe' || macroLower === 'noop') return '';
    if (macroLower === 'newline') return '\n';
    if (macroLower === 'trim') return '';

    if (macroLower === 'user' || macroContent === '<USER>' || macroContent === '<user>') return context.user || '';
    if (macroLower === 'char' || macroContent === '<BOT>' || macroContent === '<bot>') return context.char || '';

    if (macroLower === 'description' || macroLower === 'personality') {
      if (!context._usedContentGroups) context._usedContentGroups = new Set();
      if (context._usedContentGroups.has('charPersona')) return '';
      const c = context.charDescription || '';
      if (c) context._usedContentGroups.add('charPersona');
      return c;
    }

    if (macroLower === 'scenario') return context.charScenario || '';
    if (macroLower === 'persona') return context.persona || '';
    if (macroLower === 'mesexamples') return context.mesExamples || '';
    if (macroLower === 'mesexamplesraw') return context.mesExamplesRaw || '';
    if (macroLower === 'charversion') return context.charVersion || '';
    if (macroLower === 'chardepthprompt') return context.charDepthPrompt || '';
    if (macroLower === 'charprompt') return context.charPrompt || '';
    if (macroLower === 'charjailbreak') return context.charJailbreak || '';
    if (macroLower === 'group' || macroLower === 'charifnotgroup') return context.group?.join(', ') || context.char || '';
    if (macroLower === 'groupnotmuted') return context.groupNotMuted?.join(', ') || '';
    if (macroLower === 'notchar') return context.notChar?.join(', ') || '';
    if (macroLower === 'lastmessageid') return context.lastMessageId?.toString() || '';
    if (macroLower === 'lastmessage' || macroLower === 'lastchatmessage') return context.lastMessage || '';
    if (macroLower === 'lastcharmessage') return context.lastCharMessage || '';
    if (macroLower === 'lastusermessage') return context.lastUserMessage || '';
    if (macroLower === 'model') return context.model || '';
    if (macroLower === 'input') return context.input || '';
    if (macroLower === 'original') return '';

    if (macroLower === 'time') return getCurrentTime();
    if (macroLower === 'date') return getCurrentDate();
    if (macroLower === 'weekday') return getWeekday();
    if (macroLower === 'isotime') return getISOTime();
    if (macroLower === 'isodate') return getISODate();
    if (macroLower === 'idle_duration') return context.idleDuration ? humanizeDuration(context.idleDuration) : '';

    const timeUtcMatch = macroLower.match(/^time_utc([+-])(\d+)$/);
    if (timeUtcMatch) {
      const sign = timeUtcMatch[1] === '+' ? 1 : -1;
      return getTimeWithOffset(parseInt(timeUtcMatch[2]) * sign);
    }
    if (macroLower.startsWith('datetimeformat ')) return formatDateTime(macroContent.slice(15).trim());

    if (macroLower.startsWith('random:')) {
      const args = macroContent.slice(7);
      return args.includes('::') ? processRandomAlt(args) : processRandom(args);
    }
    if (macroLower.startsWith('pick::')) return processPick(macroContent.slice(6), sourceHash);
    if (macroLower.startsWith('roll:')) return processRoll(macroContent.slice(5).trim());

    if (macroLower.startsWith('getvar::')) return getVar(context.variables, macroContent.slice(8), false);
    if (macroLower.startsWith('setvar::')) {
      const parts = macroContent.slice(8).split('::');
      return parts.length >= 2 ? setVar(context.variables, parts[0], parts.slice(1).join('::'), false) : '';
    }
    if (macroLower.startsWith('addvar::')) {
      const parts = macroContent.slice(8).split('::');
      return parts.length >= 2 ? addVar(context.variables, parts[0], parts[1], false) : '';
    }
    if (macroLower.startsWith('incvar::')) return incVar(context.variables, macroContent.slice(8), false);
    if (macroLower.startsWith('decvar::')) return decVar(context.variables, macroContent.slice(8), false);
    if (macroLower.startsWith('getglobalvar::')) return getVar(context.variables, macroContent.slice(14), true);
    if (macroLower.startsWith('setglobalvar::')) {
      const parts = macroContent.slice(14).split('::');
      return parts.length >= 2 ? setVar(context.variables, parts[0], parts.slice(1).join('::'), true) : '';
    }
    if (macroLower.startsWith('incglobalvar::')) return incVar(context.variables, macroContent.slice(14), true);
    if (macroLower.startsWith('decglobalvar::')) return decVar(context.variables, macroContent.slice(14), true);
    if (macroLower.startsWith('var::')) return getVar(context.variables, macroContent.slice(5).split('::')[0], false);
    if (macroLower === 'setvar' || macroLower === 'getvar') return '';

    if (macroLower.startsWith('reverse:')) {
      const c = macroContent.slice(8);
      const inner2 = c.startsWith('(') && c.endsWith(')') ? c.slice(1, -1) : c;
      return inner2.split('').reverse().join('');
    }

    if (macroLower === 'summary') return context.summary || '';
    if (macroLower === 'authorsnote') return context.authorsNote || '';
    if (macroLower === 'charauthorsnote') return context.charAuthorsNote || '';
    if (macroLower === 'defaultauthorsnote') return context.defaultAuthorsNote || '';

    if (macroLower.startsWith('outlet::')) return context.outlets?.get(macroContent.slice(8)) || '';
    if (macroLower.startsWith('bias ') || macroLower.startsWith('banned ')) return '';

    return match;
  });

  result = result.replace(/\n*\{\{trim\}\}\n*/gi, '');
  if (context.user) result = result.replace(/<user>/gi, context.user);
  if (context.char) result = result.replace(/<bot>/gi, context.char);

  return result;
}
