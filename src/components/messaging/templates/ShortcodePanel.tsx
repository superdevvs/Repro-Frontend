import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Copy, Search } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface Shortcode {
  code: string;
  description: string;
  category: string;
}

const SHORTCODES: Shortcode[] = [
  // Recipient Info
  { code: '{{greeting}}', description: 'Dynamic greeting (Good morning…)', category: 'Recipient' },
  { code: '{{client_first_name}}', description: 'Client first name', category: 'Recipient' },
  { code: '{{client_last_name}}', description: 'Client last name', category: 'Recipient' },
  { code: '{{client_company}}', description: 'Client company/brokerage', category: 'Recipient' },
  { code: '{{client_email}}', description: 'Client email', category: 'Recipient' },
  { code: '{{client_phone}}', description: 'Client phone number', category: 'Recipient' },
  
  // Shoot Details
  { code: '{{shoot_location}}', description: 'Property address or listing title', category: 'Shoot' },
  { code: '{{shoot_address}}', description: 'Full street address', category: 'Shoot' },
  { code: '{{shoot_date}}', description: 'Scheduled shoot date', category: 'Shoot' },
  { code: '{{shoot_time}}', description: 'Scheduled shoot time', category: 'Shoot' },
  { code: '{{shoot_packages}}', description: 'Ordered services/packages', category: 'Shoot' },
  { code: '{{shoot_total}}', description: 'Quoted shoot total', category: 'Shoot' },
  { code: '{{shoot_notes}}', description: 'Internal notes or reminders', category: 'Shoot' },
  { code: '{{shoot_completed_date}}', description: 'Completion date', category: 'Shoot' },
  { code: '{{shoot_change_summary}}', description: 'Summary of modifications', category: 'Shoot' },
  
  // Photographer
  { code: '{{photographer_first_name}}', description: 'Photographer first name', category: 'Photographer' },
  { code: '{{photographer_last_name}}', description: 'Photographer last name', category: 'Photographer' },
  { code: '{{photographer_name}}', description: 'Full photographer name', category: 'Photographer' },
  
  // Payments & Billing
  { code: '{{payment_link}}', description: 'Hosted payment URL', category: 'Billing' },
  { code: '{{invoice_number}}', description: 'Invoice or order number', category: 'Billing' },
  { code: '{{amount_due}}', description: 'Outstanding balance', category: 'Billing' },
  { code: '{{due_date}}', description: 'Payment due date', category: 'Billing' },
  { code: '{{payment_amount}}', description: 'Amount paid', category: 'Billing' },
  { code: '{{payment_date}}', description: 'Payment date', category: 'Billing' },
  { code: '{{refund_amount}}', description: 'Refund total', category: 'Billing' },
  { code: '{{refund_reason}}', description: 'Reason for refund', category: 'Billing' },
  
  // Deliverables & Links
  { code: '{{photo_count}}', description: 'Number of delivered photos', category: 'Deliverables' },
  { code: '{{download_link}}', description: 'Primary download link', category: 'Deliverables' },
  { code: '{{small_zip_link}}', description: 'MLS-sized zip download', category: 'Deliverables' },
  { code: '{{full_zip_link}}', description: 'Full-resolution zip download', category: 'Deliverables' },
  { code: '{{mls_tour_link}}', description: 'MLS compliant tour link', category: 'Deliverables' },
  { code: '{{branded_tour_link}}', description: 'Branded tour link', category: 'Deliverables' },
  { code: '{{services_provided}}', description: 'List of services completed', category: 'Deliverables' },
  
  // System / Meta
  { code: '{{company_name}}', description: 'Brand name (REPro Photos)', category: 'System' },
  { code: '{{company_email}}', description: 'Support email', category: 'System' },
  { code: '{{portal_url}}', description: 'Client portal URL', category: 'System' },
  { code: '{{password_reset_link}}', description: 'Password reset URL', category: 'System' },
  { code: '{{cancellation_reason}}', description: 'Reason a shoot was cancelled', category: 'System' },
  { code: '{{decline_reason}}', description: 'Reason a request was declined', category: 'System' },
  { code: '{{original_invoice}}', description: 'Refund reference invoice', category: 'System' },
];

interface ShortcodePanelProps {
  onInsert: (shortcode: string) => void;
}

export function ShortcodePanel({ onInsert }: ShortcodePanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories = ['All', ...Array.from(new Set(SHORTCODES.map(s => s.category)))];

  const filteredShortcodes = SHORTCODES.filter(shortcode => {
    const matchesSearch = 
      shortcode.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shortcode.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || shortcode.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(`Copied ${code} to clipboard`);
  };

  return (
    <Card className="h-full flex flex-col border-0 sm:border rounded-none sm:rounded-lg">
      <div className="p-3 sm:p-4 border-b">
        <h3 className="font-semibold text-sm sm:text-base mb-2 sm:mb-3">Shortcodes</h3>
        <div className="relative mb-2 sm:mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search shortcodes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <Badge
              key={category}
              variant={selectedCategory === category ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </Badge>
          ))}
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 sm:p-4">
        <div className="space-y-1.5 sm:space-y-2">
          {filteredShortcodes.map((shortcode) => (
            <div
              key={shortcode.code}
              className="p-2.5 sm:p-3 border rounded-lg hover:bg-secondary/50 transition-colors group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <code className="text-xs sm:text-sm font-mono text-primary font-semibold break-all">
                    {shortcode.code}
                  </code>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">
                    {shortcode.description}
                  </p>
                </div>
                <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => onInsert(shortcode.code)}
                    title="Insert"
                  >
                    +
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => copyToClipboard(shortcode.code)}
                    title="Copy"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {filteredShortcodes.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>No shortcodes found</p>
          </div>
        )}
      </div>
      
      <div className="p-3 sm:p-4 border-t bg-muted/50">
        <p className="text-[10px] sm:text-xs text-muted-foreground">
          💡 <strong>Tip:</strong> Shortcodes are automatically replaced with real data when the email is sent.
        </p>
      </div>
    </Card>
  );
}

