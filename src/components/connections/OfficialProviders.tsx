'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { OFFICIAL_PROVIDERS, officialProviderToConnectionPreset } from '@/lib/official-providers';
import { addConnectionPreset, getConnectionPresets } from '@/lib/storage';
import { useI18n } from '@/components/providers/I18nProvider';
import { cn } from '@/lib/utils';

interface OfficialProvidersProps {
  /** Maximum height of the component */
  maxHeight?: string;
  /** Whether to show added status */
  showAddedStatus?: boolean;
  /** Callback when a provider is added */
  onProviderAdded?: (providerId: string) => void;
}

export default function OfficialProviders({
  maxHeight = '200px',
  showAddedStatus = true,
  onProviderAdded,
}: OfficialProvidersProps) {
  const { t } = useI18n();
  const [addedProviders, setAddedProviders] = useState<Set<string>>(() => {
    // Check which providers are already added to connections
    const connections = getConnectionPresets();
    const added = new Set<string>();
    connections.forEach(conn => {
      if (conn.id.startsWith('official-')) {
        const providerId = conn.id.replace('official-', '');
        added.add(providerId);
      }
    });
    return added;
  });

  // Function to refresh added providers status
  const refreshAddedProviders = () => {
    const connections = getConnectionPresets();
    const added = new Set<string>();
    connections.forEach(conn => {
      if (conn.id.startsWith('official-')) {
        const providerId = conn.id.replace('official-', '');
        added.add(providerId);
      }
    });
    setAddedProviders(added);
  };

  // Refresh added providers on mount
  useEffect(() => {
    refreshAddedProviders();
  }, []);

  // Listen for storage changes to update added status
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      // Check if connection presets storage changed
      if (event.key === 'connectionPresets' || event.key === null) {
        refreshAddedProviders();
      }
    };

    // Listen for storage events from other tabs/windows
    window.addEventListener('storage', handleStorageChange);
    
    // Set up polling to check for changes within same tab
    const pollInterval = setInterval(() => {
      refreshAddedProviders();
    }, 1000); // Check every 1 second (more responsive)
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(pollInterval);
    };
  }, []);

  const handleAddProvider = (providerId: string) => {
    // Safety check: prevent adding already-added providers
    if (addedProviders.has(providerId)) {
      return;
    }
    
    const provider = OFFICIAL_PROVIDERS.find(p => p.id === providerId);
    if (!provider) return;

    try {
      // Create connection preset from provider
      const connectionPreset = officialProviderToConnectionPreset(provider);
      
      // Add to connections
      addConnectionPreset(connectionPreset);
      
      // Force immediate refresh from storage to ensure consistency
      setTimeout(() => {
        refreshAddedProviders();
      }, 100);
      
      // Update added state immediately for better UX
      setAddedProviders(prev => new Set([...prev, providerId]));
      
      // Notify parent
      onProviderAdded?.(providerId);
    } catch (error) {
      console.error('Failed to add provider:', error);
      // Refresh anyway to ensure state is correct
      refreshAddedProviders();
    }
  };

  const handleOpenDocs = (url?: string) => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleOpenWebsite = (url?: string) => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            {t.officialProviders.title}
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {t.officialProviders.subtitle}
          </p>
        </div>
      </div>

      {/* Fixed height container with internal scroll */}
      <div
        className="overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
        style={{ maxHeight }}
      >
        <div className="p-3 space-y-2">
          {OFFICIAL_PROVIDERS.map((provider) => {
            const isAdded = addedProviders.has(provider.id);
            
            return (
              <Card
                key={provider.id}
                className={cn(
                  'p-3 transition-colors',
                  isAdded
                    ? 'border-green-500 bg-green-50 dark:bg-green-950'
                    : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
                )}
              >
                <CardContent className="p-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {provider.icon && (
                          <span className="text-lg">{provider.icon}</span>
                        )}
                        <h3 className="font-medium text-sm truncate">
                          {provider.name}
                        </h3>
                        {showAddedStatus && isAdded && (
                          <Badge className="bg-green-500 text-white text-xs">
                            {t.officialProviders.added}
                          </Badge>
                        )}
                      </div>
                      
                      {provider.description && (
                        <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-2">
                          {provider.description}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                        <span className="truncate">{provider.baseUrl}</span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2 ml-3">
                      <Button
                        size="sm"
                        variant={isAdded ? "outline" : "default"}
                        onClick={() => handleAddProvider(provider.id)}
                        disabled={isAdded}
                        title={isAdded ? undefined : t.officialProviders.addProviderTooltip}
                        className="whitespace-nowrap"
                      >
                        {isAdded ? t.officialProviders.added : t.officialProviders.addProvider}
                      </Button>
                      
                      <div className="flex gap-1">
                        {provider.docsUrl && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenDocs(provider.docsUrl)}
                            title={t.officialProviders.viewDocs}
                            className="h-7 w-7 p-0"
                          >
                            📄
                          </Button>
                        )}
                        
                        {provider.websiteUrl && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenWebsite(provider.websiteUrl)}
                            title={t.officialProviders.visitWebsite}
                            className="h-7 w-7 p-0"
                          >
                            🌐
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}