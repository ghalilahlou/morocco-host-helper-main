import { AirbnbSyncManager } from './AirbnbSyncManager';

interface AirbnbIcsConfigProps {
  propertyId: string;
  currentIcsUrl?: string;
  onUrlUpdated?: (newUrl: string) => void;
}

export const AirbnbIcsConfig = (props: AirbnbIcsConfigProps) => {
  return <AirbnbSyncManager {...props} />;
};
