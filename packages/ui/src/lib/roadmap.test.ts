import { describe, expect, it } from 'vitest';
import {
  REVIEW_TABS,
  currentFeatureId,
  featureGroups,
  features,
  parseReviewTab,
  reviewTabForView,
} from './roadmap';

describe('roadmap', () => {
  it('has one Ôn tập entry and no separate phrases or progress feature', () => {
    const ids = features.map((feature) => feature.id);
    expect(ids).toContain('review');
    expect(ids).not.toContain('phrases');
    expect(ids).not.toContain('progress');
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('puts Nâng cấp in the app group and points it at the web upgrade page', () => {
    const upgrade = features.find((feature) => feature.id === 'upgrade');
    expect(upgrade).toMatchObject({ label: 'Nâng cấp', group: 'app', webPath: '/upgrade' });
    expect(upgrade?.status).toEqual({ desktop: 'ready', web: 'ready' });
  });

  it('gives every feature a group that exists', () => {
    const groups = featureGroups.map((group) => group.id);
    for (const feature of features) expect(groups).toContain(feature.group);
  });

  it('lists the three review tabs in order', () => {
    expect(REVIEW_TABS.map((tab) => tab.id)).toEqual(['today', 'phrases', 'progress']);
    expect(REVIEW_TABS.map((tab) => tab.label)).toEqual(['Hôm nay', 'Kho cụm từ', 'Tiến độ']);
  });

  it('resolves the old view ids to a review tab', () => {
    expect(reviewTabForView('phrases')).toBe('phrases');
    expect(reviewTabForView('progress')).toBe('progress');
    expect(reviewTabForView('review')).toBe('today');
    expect(reviewTabForView('glossary')).toBeNull();
    expect(currentFeatureId('phrases')).toBe('review');
    expect(currentFeatureId('progress')).toBe('review');
    expect(currentFeatureId('glossary')).toBe('glossary');
  });

  it('reads ?tab= and falls back to the first tab', () => {
    expect(parseReviewTab('progress')).toBe('progress');
    expect(parseReviewTab('nope')).toBe('today');
    expect(parseReviewTab(null)).toBe('today');
  });
});
