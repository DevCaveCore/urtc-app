import React, { useState } from 'react';
import { Joyride, STATUS } from 'react-joyride';
import { Tab } from '../types';

interface InteractiveTourProps {
    run: boolean;
    onFinish: () => void;
    setTab: (tab: Tab) => void;
}

export const InteractiveTour: React.FC<InteractiveTourProps> = ({ run, onFinish, setTab }) => {
    const [stepIndex, setStepIndex] = useState(0);

    const steps: any[] = [
        {
            target: 'body',
            placement: 'center',
            title: 'Welcome to ÜrTC! 🛫',
            content: "Let's take a quick interactive tour to show you how to navigate your new AI travel companion.",
            disableBeacon: true,
        },
        {
            target: '#tour-home-start',
            title: 'Home Dashboard',
            content: 'Your central hub. Tap here to start planning a new trip, or check your upcoming itineraries.',
            disableBeacon: true,
        },
        {
            target: '#tour-flight-search',
            title: 'Live Flights',
            content: 'Search any flight route, track global flights in real-time, view your boarding passes, and get AI delay predictions.',
            disableBeacon: true,
        },
        {
            target: '#explore-weather',
            title: 'Live Weather & Location',
            content: 'The Explore tab auto-detects your city to give you live weather, interactive maps, and smart food/hotel recommendations.',
            disableBeacon: true,
        },
        {
            target: '#tour-apollo-chat',
            title: 'Apollo AI Assistant',
            content: 'Meet Apollo! Chat with him anytime for personalized travel advice, or even talk to him using voice mode.',
            disableBeacon: true,
        },
        {
            target: '#tour-itinerary-header',
            title: 'Your Plans & Itineraries',
            content: 'Save places you want to visit, let Apollo generate day-by-day itineraries, and keep all your documents secure.',
            disableBeacon: true,
        },
        {
            target: '#tour-wander-feed',
            title: 'Wander Community',
            content: 'Coming soon! A dedicated social network to share your travels and discover hidden gems from others.',
            disableBeacon: true,
        }
    ];

    const handleJoyrideCallback = (data: any) => {
        const { status, type, index, action } = data;

        if (([STATUS.FINISHED, STATUS.SKIPPED] as string[]).includes(status)) {
            // Tour is over
            onFinish();
            setStepIndex(0);
        } else if (type === 'step:after' || type === 'target:notFound') {
            // Update step to advance the tour
            const nextStepIndex = index + (action === 'prev' ? -1 : 1);
            
            // Handle Navigation before the next step renders!
            if (nextStepIndex === 1) setTab(Tab.Home);
            if (nextStepIndex === 2) setTab(Tab.Flights);
            if (nextStepIndex === 3) setTab(Tab.Explore);
            if (nextStepIndex === 4) setTab(Tab.Apollo);
            if (nextStepIndex === 5) setTab(Tab.Itinerary);
            if (nextStepIndex === 6) setTab(Tab.Wander);

            setStepIndex(nextStepIndex);
        }
    };

    return (
        <>
            {/* @ts-ignore */}
            <Joyride
                steps={steps}
                run={run}
                stepIndex={stepIndex}
                {...{ callback: handleJoyrideCallback } as any}
                continuous={true}
                showProgress={true}
                showSkipButton={true}
                styles={{
                    options: {
                        primaryColor: '#ff6b35',
                        backgroundColor: '#1c1c1e',
                        textColor: '#fff',
                        overlayColor: 'rgba(0, 0, 0, 0.7)',
                        zIndex: 10000,
                    },
                    tooltipContainer: {
                        textAlign: 'left'
                    },
                    buttonNext: {
                        backgroundColor: '#FF3B30',
                        borderRadius: '8px',
                        padding: '8px 16px',
                        fontWeight: 'bold'
                    },
                    buttonBack: {
                        marginRight: '8px',
                        color: '#8E8E93'
                    },
                    buttonSkip: {
                        color: '#9ca3af'
                    }
                } as any}
            />
        </>
    );
};
