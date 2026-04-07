
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/components/auth/AuthProvider';
import { getAccountingMode, accountingConfigs } from '@/config/accountingConfig';
import { usePermission } from '@/hooks/usePermission';
import { useLinkedSharedVisibility } from '@/hooks/useLinkedSharedVisibility';

export const useMobileMenu = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const { role, logout } = useAuth();
  const permission = usePermission();
  const linkedSharedVisibility = useLinkedSharedVisibility();
  const canViewShared = role === 'client' && linkedSharedVisibility.data.hasLinkedAccounts;

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

  // Define menu items based on effective permissions
  const menuItems = [
    {
      to: "/dashboard",
      icon: "Home",
      label: "Dashboard",
      isActive: pathname === '/dashboard',
      visible: permission.can('dashboard', 'view'),
    },
    {
      to: "/book-shoot",
      icon: "Clipboard",
      label: "Book",
      isActive: pathname === '/book-shoot',
      visible: permission.can('book-shoot', 'create'),
    },
    {
      to: "/shoot-history",
      icon: "Calendar",
      label: "Shoots",
      isActive: pathname === '/shoot-history' || pathname.startsWith('/shoots'),
      visible: permission.can('shoots', 'view'),
    },
    {
      to: "/shared",
      icon: "Link2",
      label: "Shared",
      isActive: pathname === '/shared',
      visible: canViewShared,
    },
    {
      to: "/availability",
      icon: "Calendar",
      label: "Availability",
      isActive: pathname === '/availability',
      visible: role !== 'client' && permission.can('availability', 'view'),
    },
    {
      to: "/chat-with-reproai",
      icon: "Robbie",
      label: "Robbie",
      isActive: pathname === '/chat-with-reproai',
      visible: permission.can('robbie', 'view'),
    },
    {
      to: "/accounts",
      icon: "Building",
      label: "Accounts",
      isActive: pathname === '/accounts',
      visible: permission.can('accounts', 'view'),
    },
    {
      to: "/scheduling-settings",
      icon: "Calendar",
      label: "Scheduling",
      isActive: pathname === '/scheduling-settings',
      visible: permission.can('scheduling-settings', 'view'),
    },
    {
      to: "/portal",
      icon: "Crown",
      label: "Exclusive Listings",
      isActive: pathname === '/portal' || pathname.startsWith('/exclusive-listings'),
      visible: permission.can('portal', 'view'),
    },
    {
      to: "/accounting",
      icon: "FileText",
      label: getAccountingLabel(),
      isActive: pathname === '/accounting',
      visible: permission.can('accounting', 'view'),
    },
    {
      to: "/messaging/email/inbox",
      icon: "MessageSquare",
      label: role === 'client' ? "Contact" : "Messaging",
      isActive: pathname.startsWith('/messaging/email'),
      visible:
        permission.can('messaging-email', 'view') &&
        !permission.can('messaging-overview', 'view') &&
        !permission.can('messaging-sms', 'view'),
    },
    {
      to: "/messaging/overview",
      icon: "MessageSquare",
      label: "Messaging",
      isActive: pathname.startsWith('/messaging'),
      visible: permission.can('messaging-overview', 'view') || permission.can('messaging-sms', 'view'),
      subItems: [
        ...(permission.can('messaging-email', 'view') ? [{ to: '/messaging/email/inbox', label: 'Emails' }] : []),
        ...(permission.can('messaging-sms', 'view') ? [{ to: '/messaging/sms', label: 'SMS' }] : []),
      ]
    },
    {
      to: "/settings",
      icon: "Settings",
      label: "Settings",
      isActive: pathname === '/settings',
      visible: permission.can('settings', 'view'),
    },
    {
      to: "/cubicasa-scanning",
      icon: "Home",
      label: "Property Scan",
      isActive: pathname === '/cubicasa-scanning',
      visible: permission.can('cubicasa-scanning', 'view'),
    },
    {
      to: "/ai-editing",
      icon: "Sparkles",
      label: "AI Editing",
      isActive: pathname === '/ai-editing' || pathname.startsWith('/ai-editing'),
      visible: permission.can('ai-editing', 'view'),
    }
  ];

  const filteredItems = menuItems.filter(item => item.visible);

  return {
    isMenuOpen,
    toggleMenu,
    closeMenu,
    handleLogout,
    filteredItems
  };
};
