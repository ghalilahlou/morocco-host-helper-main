import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PropertyList } from '@/components/PropertyList';
import { Property } from '@/types/booking';
import { useAuth } from '@/hooks/useAuth';

const Index = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/auth');
    }
  }, [isAuthenticated, isLoading, navigate]);

  const handlePropertySelect = (property: Property) => {
    console.log('Navigating to property:', property.id);
    navigate(`/dashboard/property/${property.id}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Chargement…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect to auth page
  }

  return (
    <PropertyList onPropertySelect={handlePropertySelect} />
  );
};

export default Index;
