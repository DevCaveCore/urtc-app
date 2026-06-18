import React, { useEffect, useRef } from 'react';

interface AdSenseWidgetProps {
  adClient: string;
  adSlot: string;
  adFormat?: string;
  fullWidthResponsive?: boolean;
  className?: string;
}

export const AdSenseWidget: React.FC<AdSenseWidgetProps> = ({
  adClient,
  adSlot,
  adFormat = 'auto',
  fullWidthResponsive = true,
  className = '',
}) => {
  const adRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    try {
      // @ts-ignore
      if (typeof window !== 'undefined' && window.adsbygoogle) {
        // @ts-ignore
        window.adsbygoogle.push({});
      }
    } catch (err) {
      console.error('AdSense error', err);
    }
  }, []);

  return (
    <div className={`overflow-hidden flex justify-center ${className}`}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block', width: '100%' }}
        data-ad-client={adClient}
        data-ad-slot={adSlot}
        data-ad-format={adFormat}
        data-full-width-responsive={fullWidthResponsive ? 'true' : 'false'}
      />
    </div>
  );
};
