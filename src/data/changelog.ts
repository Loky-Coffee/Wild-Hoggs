export interface ChangelogEntry {
  date: string; // "2026-03-21"
  time: string; // "HH:MM"
  text: string;
}

export const changelog: ChangelogEntry[] = [
  // ── July 2026 ───────────────────────────────────────────────────────────
  {
    date: '2026-07-01',
    time: '19:30',
    text: 'Research calculator: fixed the red target outline staying on the old node when you pick a new target — it now moves to the selected node',
  },
  {
    date: '2026-07-01',
    time: '19:15',
    text: 'All calculators: fixed leveled/maxed nodes appearing dimmed after reloading the page — saved state is now applied right after load, so nodes reliably show as active',
  },
  {
    date: '2026-07-01',
    time: '19:00',
    text: 'Research calculator: fixed levels not saving for logged-in users and maxed nodes appearing dimmed — your levels are never auto-cleared now, a node with a level always shows as active, and only its direct dependents deselect when you lower a prerequisite',
  },
  {
    date: '2026-07-01',
    time: '18:50',
    text: 'Research calculator: opens noticeably faster — a tree now loads only its own node icons instead of every tree\'s icons',
  },
  {
    date: '2026-07-01',
    time: '18:40',
    text: 'Research & Tank calculators: fixed console hydration warnings and occasional flicker when navigating between pages',
  },
  {
    date: '2026-07-01',
    time: '18:30',
    text: 'Research overview: category cards now sort by progress — in-progress trees on top, untouched in the middle, completed (MAX) at the bottom',
  },
  {
    date: '2026-07-01',
    time: '18:20',
    text: 'Research: new "Compare Trees" page — pick two trees and see every node\'s max-level bonus side by side, line by line (linked from the research overview and each calculator)',
  },
  {
    date: '2026-07-01',
    time: '18:10',
    text: 'Research: nodes that unlock a building, function or unit now show it (e.g. "Unlock Lv.10 Unit", "New Structure: Steel Plant", "Resource Protection +1000") in all 15 languages',
  },
  {
    date: '2026-07-01',
    time: '18:00',
    text: 'Research: the level picker now shows each node\'s stat bonus per level (e.g. "Field Troop ATK +50%"), available in all 15 languages',
  },
  {
    date: '2026-07-01',
    time: '17:45',
    text: 'Research & Tank calculators: selecting a level in the bottom sheet now applies immediately and closes the sheet',
  },
  {
    date: '2026-07-01',
    time: '17:20',
    text: 'Research & Tank calculators: fixed the level picker not opening on mobile — tapping a node now reliably opens the bottom sheet',
  },
  {
    date: '2026-07-01',
    time: '16:40',
    text: 'Tank modifications: tree view switched to the same bottom-sheet picker — tap a modification to choose its sub-level; previous levels auto-unlock and are set to max',
  },
  {
    date: '2026-07-01',
    time: '16:20',
    text: 'Research calculator: tree nodes are now read-only — tap any node to open a bottom sheet and pick a level; the per-level table shows Strom/Zent/Badge costs, selecting a level auto-unlocks its prerequisites, and lowering or resetting a node cascades down to its dependents',
  },
  {
    date: '2026-07-01',
    time: '15:30',
    text: 'Research: corrected all tree data from the game (prerequisites, per-level Strom/Zent/Badge costs, lab levels, combat power) and added 10 new research trees — fully translated in all 15 languages',
  },

  // ── March 2026 ──────────────────────────────────────────────────────────
  {
    date: '2026-03-31',
    time: '21:10',
    text: 'Profiles: multi-profile system launched — each account can have multiple in-game profiles with independent calculator state, server, faction, and formation power; profile switcher in the navigation header',
  },
  {
    date: '2026-03-31',
    time: '17:09',
    text: 'Research: category cards redesigned — responsive auto-fill grid, tree progress % badge in the corner (shows MAX in green when fully completed)',
  },
  {
    date: '2026-03-25',
    time: '19:24',
    text: 'Research tree: fixed horizontal centering in vertical layout on desktop',
  },
  {
    date: '2026-03-21',
    time: '20:16',
    text: 'Site rebranded as personal guide by Ediva — Members tab removed, About page redesigned, homepage updated',
  },

  // ── March 2026 (Research fixes) ─────────────────────────────────────────
  {
    date: '2026-03-03',
    time: '17:45',
    text: 'Research tree: fixed iOS horizontal zoom (deferred via requestAnimationFrame to resolve clientHeight=0)',
  },
  {
    date: '2026-03-02',
    time: '14:12',
    text: 'Research tree: fixed mobile zoom on deep horizontal layouts using a fixed zoom target',
  },

  // ── February 2026 — Week 4 ──────────────────────────────────────────────
  {
    date: '2026-02-28',
    time: '21:30',
    text: 'Chat: replaced action button strip with a radial fan menu attached to each message bubble',
  },
  {
    date: '2026-02-28',
    time: '20:55',
    text: 'Chat: unread count displayed on inactive tabs; tracking works across page navigations',
  },
  {
    date: '2026-02-28',
    time: '20:10',
    text: 'Notifications: per-user sound volume setting stored in database and adjustable in profile',
  },
  {
    date: '2026-02-28',
    time: '19:40',
    text: 'Mobile: unread DM badge added to the sidebar toggle button',
  },
  {
    date: '2026-02-28',
    time: '18:50',
    text: 'Calculators: auto-calculate triggers on first click — no layout jump on initial load',
  },
  {
    date: '2026-02-27',
    time: '22:00',
    text: 'Notifications: global background polling added with unread badges across all chat channels',
  },
  {
    date: '2026-02-27',
    time: '21:15',
    text: 'Notifications: unread DM count persisted via localStorage bridge between page navigations',
  },
  {
    date: '2026-02-27',
    time: '20:30',
    text: 'Admin: Lucky Rose and Reward Codes are now managed via the admin panel (stored in database)',
  },
  {
    date: '2026-02-27',
    time: '19:45',
    text: 'Chat: private messaging (DM) launched — send direct messages to any registered user',
  },
  {
    date: '2026-02-27',
    time: '18:55',
    text: 'Chat: online users sidebar with live presence tracking (refreshes every 5 seconds)',
  },
  {
    date: '2026-02-27',
    time: '18:10',
    text: 'Chat: reply-to message feature — quote any message in your response',
  },
  {
    date: '2026-02-27',
    time: '17:20',
    text: 'Chat: message reporting dialog with reason selection added for all users',
  },
  {
    date: '2026-02-27',
    time: '16:30',
    text: 'Admin: moderator role introduced — can delete chat messages and access a restricted panel view',
  },
  {
    date: '2026-02-27',
    time: '15:40',
    text: 'Admin: reports table with combinable filters; users table with last-login column and admin toggle',
  },
  {
    date: '2026-02-27',
    time: '14:50',
    text: 'Chat: language-specific channels — up to 4 tabs based on active languages',
  },
  {
    date: '2026-02-27',
    time: '14:00',
    text: 'Profile: individual faction cards showing formation power; Caravan calculator auto-fills from profile',
  },
  {
    date: '2026-02-27',
    time: '13:10',
    text: 'Mobile: iOS Safari auto-zoom on input/textarea/select fields prevented site-wide',
  },
  {
    date: '2026-02-27',
    time: '12:20',
    text: 'Admin panel fully translated into all 15 supported languages',
  },
  {
    date: '2026-02-27',
    time: '11:30',
    text: 'SEO: Schema.org JSON-LD structured data added to 4 pages; Apple touch icon added for iOS',
  },

  // ── February 2026 — Week 3 ──────────────────────────────────────────────
  {
    date: '2026-02-26',
    time: '22:18',
    text: 'Tank: super upgrade widget launched with grouped desktop stats and mobile layout',
  },
  {
    date: '2026-02-26',
    time: '21:38',
    text: 'Research: badge progress indicator added to all category cards',
  },
  {
    date: '2026-02-26',
    time: '20:30',
    text: 'Profile: server field added — shown on registration, profile card, and settings',
  },
  {
    date: '2026-02-26',
    time: '19:14',
    text: 'Profile page launched — faction selection, stats, username and password management',
  },
  {
    date: '2026-02-26',
    time: '18:50',
    text: 'Authentication launched — login, registration, session management via Cloudflare D1',
  },
  {
    date: '2026-02-24',
    time: '18:10',
    text: 'Multiple calculator fixes: building costs off-by-one, hero max level, target-exceeded state',
  },
  {
    date: '2026-02-24',
    time: '02:06',
    text: 'Accessibility: focus-visible outlines, ARIA roles, heading hierarchy and contrast ratios improved site-wide',
  },
  {
    date: '2026-02-23',
    time: '23:49',
    text: 'Calculators: unified Hero and Building calculator layout; custom dropdown component introduced',
  },
  {
    date: '2026-02-23',
    time: '22:39',
    text: 'Navigation switched to sticky positioning; custom orange scrollbar added site-wide',
  },
  {
    date: '2026-02-23',
    time: '21:34',
    text: 'SEO: page-specific Open Graph images added for all tool and content pages',
  },
  {
    date: '2026-02-23',
    time: '22:28',
    text: 'Dependencies updated: Zod v4 migration, TypeScript type improvements',
  },

  // ── February 2026 — Week 2 ──────────────────────────────────────────────
  {
    date: '2026-02-06',
    time: '06:38',
    text: 'Tank tree: zoom controls optimized for mobile with focus-zoom and 3-column layout',
  },
  {
    date: '2026-02-06',
    time: '04:25',
    text: 'Performance: i18n dynamic imports implemented — 71% reduction in initial bundle size',
  },
  {
    date: '2026-02-05',
    time: '21:47',
    text: 'Research tree: keyboard navigation added (arrow keys, Enter to unlock)',
  },
  {
    date: '2026-02-05',
    time: '21:36',
    text: 'Global breadcrumb navigation added across all pages with accessibility improvements',
  },
  {
    date: '2026-02-05',
    time: '18:07',
    text: 'Reward Codes and Lucky Roses split into two separate dedicated pages',
  },
  {
    date: '2026-02-05',
    time: '02:29',
    text: 'i18n routing fully activated for all 15 languages with SEO-optimized URL structure',
  },

  // ── February 2026 — Week 1 ──────────────────────────────────────────────
  {
    date: '2026-02-04',
    time: '14:36',
    text: 'Research tree: iOS Safari touch support fixed for range sliders using RangeTouch library',
  },
  {
    date: '2026-02-03',
    time: '21:29',
    text: 'Research Calculator: multiple new categories activated (Unit Special Training, Peace Shield, Siege, etc.)',
  },
  {
    date: '2026-02-03',
    time: '17:47',
    text: 'Research Calculator: progressive dependency support — prerequisites must be fully leveled first',
  },
  {
    date: '2026-02-02',
    time: '19:58',
    text: 'Automatic reward code updates via Cloudflare Pages Function (fetches latest codes)',
  },
  {
    date: '2026-02-02',
    time: '18:01',
    text: 'All accessibility, SEO, and performance audit points resolved before launch',
  },
  {
    date: '2026-02-02',
    time: '17:26',
    text: 'Building calculator launched with full upgrade cost breakdown per building level',
  },
  {
    date: '2026-02-02',
    time: '08:17',
    text: 'Hero database launched — 36 heroes with filters, faction icons, skills, and star ratings',
  },
  {
    date: '2026-02-02',
    time: '08:00',
    text: 'Caravan calculator launched with faction system and enemy hero buff calculations',
  },
  {
    date: '2026-02-02',
    time: '01:24',
    text: 'Wild Hoggs website launched — Research tree, Tank calculator, Reward Codes, Lucky Roses, Events, Guides',
  },
];
