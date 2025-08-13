import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Globe, History, Settings, Home, FileStack } from 'lucide-react';

const Navigation: React.FC = () => {
  const location = useLocation();
  
  const navItems = [
    {
      path: '/',
      label: '首页',
      icon: Home
    },
    {
      path: '/batch',
      label: '批量爬取',
      icon: FileStack
    },
    {
      path: '/results',
      label: '任务历史',
      icon: History
    },
    {
      path: '/settings',
      label: '设置',
      icon: Settings
    }
  ];
  
  const isActive = (path: string) => {
    if (path === '/batch') {
      return location.pathname === '/batch' || location.pathname.startsWith('/batch/');
    }
    return location.pathname === path;
  };
  
  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <Globe className="w-8 h-8 text-blue-600" />
            <span className="text-xl font-bold text-gray-800">网页爬虫PDF生成器</span>
          </Link>
          
          {/* Navigation Links */}
          <div className="flex space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive(item.path)
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;