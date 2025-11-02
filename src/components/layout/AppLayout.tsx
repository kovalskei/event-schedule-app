import { Link, useLocation } from 'react-router-dom';
import Icon from '@/components/ui/icon';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();

  const navItems = [
    { path: '/', icon: 'Calendar', label: 'Мероприятия' },
    { path: '/templates', icon: 'FileText', label: 'Шаблоны' },
    { path: '/campaigns', icon: 'Send', label: 'Кампании' },
    { path: '/history', icon: 'History', label: 'История' },
    { path: '/ai-settings', icon: 'Settings', label: 'AI Настройки' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <Icon name="Rocket" className="w-6 h-6 text-indigo-600" />
              <span className="text-xl font-bold text-gray-900">Email Campaign</span>
            </div>
            
            <div className="flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`
                      flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                      ${isActive 
                        ? 'bg-indigo-100 text-indigo-700' 
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      }
                    `}
                  >
                    <Icon name={item.icon as any} size={18} />
                    <span className="hidden md:inline">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </nav>
      
      <main>{children}</main>
    </div>
  );
}
