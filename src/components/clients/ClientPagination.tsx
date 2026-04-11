
import React from 'react';
import { 
  Pagination, 
  PaginationContent, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious 
} from '@/components/ui/pagination';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ClientPaginationProps {
  currentPage: number;
  totalPages: number;
  setCurrentPage: (page: number) => void;
}

export const ClientPagination: React.FC<ClientPaginationProps> = ({ 
  currentPage, 
  totalPages, 
  setCurrentPage 
}) => {
  const renderPageNumbers = () => {
    const pageNumbers = [];
    const maxPagesToShow = 5;
    
    if (totalPages <= maxPagesToShow) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
      const endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
      
      if (endPage - startPage + 1 < maxPagesToShow) {
        startPage = Math.max(1, endPage - maxPagesToShow + 1);
      }
      
      if (startPage > 1) {
        pageNumbers.push(1);
        if (startPage > 2) {
          pageNumbers.push('ellipsis');
        }
      }
      
      for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(i);
      }
      
      if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
          pageNumbers.push('ellipsis');
        }
        pageNumbers.push(totalPages);
      }
    }
    
    return pageNumbers;
  };

  if (totalPages <= 1) return null;

  return (
    <div className="mt-6 flex justify-center">
      <Pagination>
        <PaginationContent className="bg-background p-1 rounded-lg shadow-sm border">
          <PaginationItem>
            <Button 
              variant="ghost"
              size="sm"
              className={`h-9 ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeftIcon className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline text-sm font-normal">Previous</span>
            </Button>
          </PaginationItem>
          
          {renderPageNumbers().map((page, index) => (
            page === 'ellipsis' ? (
              <PaginationItem key={`ellipsis-${index}`}>
                <span className="flex h-9 w-9 items-center justify-center text-sm text-muted-foreground">
                  …
                </span>
              </PaginationItem>
            ) : (
              <PaginationItem key={`page-${page}`}>
                <PaginationLink
                  isActive={currentPage === page}
                  onClick={() => setCurrentPage(page as number)}
                  className={`h-9 w-9 p-0 font-medium ${
                    currentPage === page
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'hover:bg-muted'
                  }`}
                >
                  {page}
                </PaginationLink>
              </PaginationItem>
            )
          ))}
          
          <PaginationItem>
            <Button 
              variant="ghost"
              size="sm"
              className={`h-9 ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              onClick={() => setCurrentPage(Math.min(currentPage + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              <span className="hidden sm:inline text-sm font-normal">Next</span>
              <ChevronRightIcon className="h-4 w-4 ml-1" />
            </Button>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
};
