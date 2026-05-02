import { useState, useEffect } from 'react';
import { Link, useRoute } from 'wouter';
import { LayoutDashboard, Plug, ScrollText, Code2, Settings, ChevronLeft, ChevronRight, Beer, Menu, X, LogOut, FlaskConical, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/connections', label: 'Connections', icon: Plug },
  { path: '/presets', label: 'Presets', icon: ScrollText },
  { path: '/extensions', label: 'Extensions', icon: Code2 },
  { path: '/settings', label: 'Settings', icon: Settings },
];

function NavItem({ path, label, icon: Icon, collapsed }: { path: string; label: string; icon: React.ElementType; collapsed: boolean }) {
  const [isActive] = useRoute(path === '/' ? '/' : `${path}*`);

  return (
    <Link href={path}>
      <div className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200 relative group',
        isActive
          ? 'bg-primary/15 text-primary border border-primary/30'
          : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        collapsed ? 'justify-center' : ''
      )}>
        {isActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r-full" />
        )}
        <Icon size={18} className={cn('shrink-0', isActive ? 'text-primary' : '')} />
        {!collapsed && (
          <span className="text-sm font-medium truncate">{label}</span>
        )}
        {collapsed && (
          <div className="absolute left-full ml-2 px-2 py-1 bg-popover border border-popover-border text-popover-foreground text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
            {label}
          </div>
        )}
      </div>
    </Link>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { logout, username, authConfigured } = useAuth();

  useEffect(() => {
    const saved = localStorage.getItem('jt.sidebarCollapsed');
    if (saved === 'true') setCollapsed(true);
  }, []);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('jt.sidebarCollapsed', String(next));
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={cn(
        'fixed md:relative z-50 md:z-auto flex flex-col h-full border-r border-sidebar-border bg-sidebar transition-all duration-300 shrink-0',
        collapsed ? 'w-16' : 'w-56',
        mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
      )}>
        <div className={cn('flex items-center gap-2.5 p-4 border-b border-sidebar-border', collapsed ? 'justify-center' : '')}>
          <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center shrink-0">
            <Beer size={16} className="text-primary" />
          </div>
          {!collapsed && (
            <div>
              <div className="text-sm font-bold text-sidebar-foreground leading-none">Janitor's</div>
              <div className="text-xs text-primary font-semibold">Tavern</div>
            </div>
          )}
        </div>

        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <NavItem key={item.path} {...item} collapsed={collapsed} />
          ))}

          <div className="pt-1 border-t border-sidebar-border mt-1">
            <Link href="/test-storage">
              <div className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200 relative group text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                collapsed ? 'justify-center' : ''
              )}>
                <FlaskConical size={18} className="shrink-0" />
                {!collapsed && <span className="text-sm font-medium truncate">Diagnostics</span>}
                {collapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-popover border border-popover-border text-popover-foreground text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                    Diagnostics
                  </div>
                )}
              </div>
            </Link>
          </div>
        </nav>

        {authConfigured && (
          <div className={cn('p-2 border-t border-sidebar-border space-y-1')}>
            {!collapsed && username && (
              <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground">
                <User size={12} />
                <span className="truncate">{username}</span>
              </div>
            )}
            <button
              onClick={logout}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive transition-colors text-xs',
                collapsed ? 'justify-center' : ''
              )}
              title="Sign out"
            >
              <LogOut size={14} />
              {!collapsed && <span>Sign Out</span>}
            </button>
          </div>
        )}

        <div className={cn('p-2', authConfigured ? '' : 'border-t border-sidebar-border')}>
          <button
            onClick={toggleCollapse}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors text-xs"
          >
            {collapsed ? <ChevronRight size={14} /> : <><ChevronLeft size={14} /><span>Collapse</span></>}
          </button>
        </div>
      </aside>

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <header className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-sidebar">
          <button onClick={() => setMobileOpen(!mobileOpen)} className="text-sidebar-foreground">
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="flex items-center gap-2">
            <Beer size={16} className="text-primary" />
            <span className="text-sm font-bold text-foreground">Janitor's Tavern</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
