
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/components/auth/AuthProvider';
import { getAccountingMode, accountingConfigs } from '@/config/accountingConfig';

export const useMobileMenu = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const { user, role, logout } = useAuth();

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  const handleLogout = () => {
    closeMenu();
    logout();
  };

  // Get accounting label based on role
  const getAccountingLabel = () => {
    const accountingMode = getAccountingMode(role);
    return accountingConfigs[accountingMode].sidebarLabel;
  };

  // Define menu items based on user role
  const menuItems = [
    {
      to: "/dashboard",
      icon: "Home",
      label: "Dashboard",
      isActive: pathname === '/dashboard',
      roles: ['client', 'admin', 'superadmin', 'photographer', 'editor']
    },
    {
      to: "/book-shoot",
      icon: "Clipboard",
      label: "Book",
      isActive: pathname === '/book-shoot',
      roles: ['client', 'admin', 'superadmin']
    },
    {
      to: "/shoot-history",
      icon: "Calendar",
      label: "Shoots",
      isActive: pathname === '/shoot-history' || pathname.startsWith('/shoots'),
      roles: ['client', 'admin', 'superadmin', 'photographer', 'editor']
    },
    {
      to: "/chat-with-reproai",
      icon: "Robbie",
      label: "Robbie",
      isActive: pathname === '/chat-with-reproai',
      roles: ['client', 'admin', 'superadmin']
    },
    {
      to: "/accounts",
      icon: "Building",
      label: "Accounts",
      isActive: pathname === '/accounts',
      roles: ['admin', 'superadmin']
    },
    {
      to: "/scheduling-settings",
      icon: "Calendar",
      label: "Scheduling",
      isActive: pathname === '/scheduling-settings',
      roles: ['admin', 'superadmin']
    },
    {
      to: "/portal",
      icon: "Search",
      label: "Exclusive Listings",
      isActive: pathname === '/portal' || pathname.startsWith('/exclusive-listings'),
      roles: ['admin', 'superadmin', 'editing_manager', 'salesRep', 'client']
    },
    {
      to: "/accounting",
      icon: "FileText",
      label: getAccountingLabel(),
      isActive: pathname === '/accounting',
      roles: ['client', 'admin', 'superadmin', 'photographer', 'editor', 'salesRep']
    },
    {
      to: "/messaging/email/inbox",
      icon: "MessageSquare",
      label: "Messaging",
      isActive: pathname.startsWith('/messaging/email'),
      roles: ['client']
    },
    {
      to: "/messaging/overview",
      icon: "MessageSquare",
      label: "Messaging",
      isActive: pathname.startsWith('/messaging'),
      roles: ['admin', 'superadmin', 'editing_manager', 'salesRep'],
      subItems: [
        { to: '/messaging/email/inbox', label: 'Emails' },
        { to: '/messaging/sms', label: 'SMS' },
      ]
    },
    {
      to: "/availability",
      icon: "Calendar",
      label: "Availability",
      isActive: pathname === '/availability',
      roles: ['admin', 'photographer']
    },
    {
      to: "/settings",
      icon: "Settings",
      label: "Settings",
      isActive: pathname === '/settings',
      roles: ['client', 'admin', 'superadmin', 'photographer', 'editor']
    },
    {
      to: "/cubicasa-scanning",
      icon: "Home",
      label: "Property Scan",
      isActive: pathname === '/cubicasa-scanning',
      roles: ['photographer', 'admin', 'superadmin']
    },
    {
      to: "/ai-editing",
      icon: "Sparkles",
      label: "AI Editing",
      isActive: pathname === '/ai-editing' || pathname.startsWith('/ai-editing'),
      roles: ['admin', 'superadmin']
    }
  ];

  // Filter items based on user role
  const filteredItems = menuItems.filter(item => item.roles.includes(role));

  return {
    isMenuOpen,
    toggleMenu,
    closeMenu,
    handleLogout,
    filteredItems
  };
};
