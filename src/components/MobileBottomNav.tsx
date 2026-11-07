import { Icon } from './Icon';

export type MobileTab = 'today' | 'calendar' | 'sketchbook';

interface Props {
  activeTab: MobileTab;
  onSelect: (tab: MobileTab) => void;
}

const tabs: { id: MobileTab; label: string; icon: 'spark' | 'calendar' | 'book' }[] = [
  { id: 'today', label: 'Today', icon: 'spark' },
  { id: 'calendar', label: 'Calendar', icon: 'calendar' },
  { id: 'sketchbook', label: 'Sketchbook', icon: 'book' },
];

export function MobileBottomNav({ activeTab, onSelect }: Props) {
  return <nav className="mobile-bottom-nav" aria-label="Main navigation">
    {tabs.map((tab) => <button
      className="mobile-bottom-nav__button"
      type="button"
      key={tab.id}
      onClick={() => onSelect(tab.id)}
      aria-current={activeTab === tab.id ? 'page' : undefined}
    >
      <Icon name={tab.icon} />
      <span>{tab.label}</span>
    </button>)}
  </nav>;
}
