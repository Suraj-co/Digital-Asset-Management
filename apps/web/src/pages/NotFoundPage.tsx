import { Link } from 'react-router';
import { PageHeader } from '@/components/shell/PageHeader';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  return (
    <div>
      <PageHeader
        title="Page not available"
        description="This address is not part of the Module 0 environment check. Product screens are added in later modules."
        actions={
          <Button asChild>
            <Link to="/">Back to environment status</Link>
          </Button>
        }
      />
    </div>
  );
}
