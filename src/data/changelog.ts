export interface ChangelogEntry {
  date: string; // "2026-03-21"
  time: string; // "HH:MM"
  /**
   * Fliesstext. **Doppelte Sternchen** heben etwas hervor — fuer Namen,
   * Zahlen oder Begriffe, die ins Auge springen sollen:
   *     text: 'Danke an **Xcorpia07** fuer den Vorschlag'
   */
  text: string;
}

/**
 * Wandelt **…** in <strong> um. Alles andere wird vorher escaped, damit im
 * Changelog kein rohes HTML landen kann — auch wenn der Text aus dem Repo
 * kommt und nicht von Nutzern.
 */
export function renderChangelogText(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  return escaped.replace(/\*\*([^*]+)\*\*/g, '<strong class="changelog-hl">$1</strong>');
}

export const changelog: ChangelogEntry[] = [
  // ── August 2026 ─────────────────────────────────────────────────────────
  {
    date: '2026-08-12',
    time: '14:50',
    text: 'Every page now loads **196 KB less** — a charting library had ended up in a bundle that was being fetched everywhere, although it is only needed on one internal page. Nothing looks different, the site just starts faster, especially on mobile data',
  },
  {
    date: '2026-08-12',
    time: '13:20',
    text: 'Community messages now show the **exact date and time** next to the “3 days ago”, in your own language and time zone. Handy when you are arranging something around an event and need to know whether a message was written on Friday or on Saturday. Today’s messages show only the time, and the year appears only when it is not the current one',
  },
  {
    date: '2026-08-10',
    time: '19:20',
    text: 'The building calculator has a new **Saving** button for the **Season 4** specialisation that lowers build costs — 2% per level, **10% at level 5**, applied to food, wood, steel and Z coins. Two things were also missing from the city itself: there are **four windmills**, not one (just like the lumberyards), and **two hospitals**. Special thanks to **SkippySlippy** from **server 450** for pointing all of this out',
  },
  {
    date: '2026-08-08',
    time: '18:05',
    text: 'Every active code now has a **Redeem** button. It copies the code and opens the official Gift Center **right at the input field**, in your own language — so all that is left to do is paste it. Filling the code in for you is not possible, the official page does not accept it through the link. But it saves finding the page, switching its language, scrolling down and typing the code by hand, where a **single typo** means no reward',
  },
  {
    date: '2026-08-08',
    time: '17:55',
    text: 'Gift codes now find their way here on their own. The official Last Z announcement channel is checked **every ten minutes**, and anything that looks like a code is picked up automatically — so new codes should appear here **within minutes** of being announced, instead of whenever somebody happened to notice them. Nothing goes live unchecked: every find waits for approval first, so a false alarm never reaches you',
  },
  {
    date: '2026-08-06',
    time: '17:15',
    text: 'Your profile page is now organised in **four tabs** instead of one long column. **Overview** shows how long you have been here and how active you are, **Game profiles** lets you manage several accounts side by side (this used to hide in the menu at the top right), **Settings** holds your name, password and notification sound, and **Account** is new: you can now **download all your data** and **delete your account** yourself. The faction picker takes a quarter of the space it used to, and changing your faction now also updates your name colour in chat — which it never did before',
  },
  {
    date: '2026-08-06',
    time: '16:05',
    text: 'The Heroes page no longer freezes when you open a hero. A blur effect was being applied across the whole screen on top of 250 shadow effects — and it was invisible anyway behind the dark overlay. Opening a hero went from **locking up the tab** to **41 milliseconds**. The page also loads **37% less image data** now, so it appears faster and is easier on mobile data',
  },
  {
    date: '2026-08-06',
    time: '14:30',
    text: 'The site now notices by itself when a newer version is available and offers to reload — no more sitting on an old version for days without knowing. If the tab is in the background it just refreshes quietly, so nothing you were typing can get lost. There is also a **notice bar** now for occasional announcements, for things like planned maintenance',
  },
  {
    date: '2026-08-06',
    time: '12:05',
    text: 'The chat is now **fully live**. Messages, the unread badges on the other tabs, private messages and the online list all arrive **the moment they happen** instead of being fetched every few seconds — the page no longer asks the server at all while the connection holds. If the live connection cannot be established (restrictive network, or the service is down), everything falls back to the old behaviour on its own, so the chat keeps working either way',
  },
  {
    date: '2026-08-05',
    time: '19:55',
    text: 'Two things that flickered are now calm. Switching pages briefly faded the old and the new page into each other, which on a dark theme looks like a **stray page flashing up** before the right one — the switch is instant now. And on the **Roses** page, rose 10 lit up for a moment before jumping to the one actually set; now nothing is highlighted until the real answer arrives, because showing nothing beats showing the wrong one',
  },
  {
    date: '2026-08-05',
    time: '17:05',
    text: 'Fixed the site slowly grinding to a halt when you left it open for a long time (a few hours would eventually freeze the tab). The chat was keeping every single message it had ever received, so the page got heavier the longer it ran — it now holds the most recent 200, and the animated name tags only shimmer on the newest messages instead of all of them at once. The menu and the language picker were also leaving something behind on every page change. Everything works as before, it just stays fast now',
  },
  {
    date: '2026-08-05',
    time: '16:20',
    text: 'New buff in the speed settings: the seasonal specialisation "Support" (available from the second season / Ice Season onwards) can now be ticked at Lv.1 (+10%) or Lv.2 (+15%) — in both the research speed and the build speed pop-up, so research and construction times take it into account. Thanks to **Xcorpia07** for the suggestion',
  },
  // ── July 2026 ───────────────────────────────────────────────────────────
  {
    date: '2026-07-11',
    time: '16:05',
    text: 'Setting a target now draws a red trail alongside the blue connection lines — it follows the whole path (all prerequisites) you still need to complete to reach the target, and skips nodes that are already maxed. Works in both the research and tank trees',
  },
  {
    date: '2026-07-11',
    time: '02:40',
    text: 'Target level now works on the Tank too: setting a target on a modification asks which sub-level to aim for, and the panel shows the wrenches needed to reach it (plus a button to clear the target). In both the research and tank target pickers, levels you have already reached are greyed out — you can only aim higher',
  },
  {
    date: '2026-07-11',
    time: '02:05',
    text: 'Research target: setting a target on a node now asks which level you want to aim for (a quick pop-up) instead of always aiming for max. The target summary on the left recalculates to exactly that level, and the node\'s target button shows the chosen level',
  },
  {
    date: '2026-07-11',
    time: '01:40',
    text: 'Research & Tank trees: a node that is fully maxed now shows a green "Done" ribbon and can no longer be picked as a target (there is nothing left to reach). Each node\'s progress bar also shows a tick per level so you can read the granularity at a glance',
  },
  {
    date: '2026-07-11',
    time: '00:30',
    text: 'Building calculator: new "Hide duplicates" button (next to Build-Speed) collapses the numbered copies to just the first of each (e.g. Residence 2–6, Steel Plant 2–5) — on by default, and it flips to "Show all buildings" when active. The Formation buildings are now correctly one building with 4 identical copies instead of four separate entries',
  },
  {
    date: '2026-07-10',
    time: '22:00',
    text: 'Research level picker: the bottom now shows two clear lines — "Used" (spent up to your current level) and "Remaining" (what is left to max; with nothing selected it shows the whole node) — and numbers use compact K/M/G notation so everything fits on one line',
  },
  {
    date: '2026-07-10',
    time: '21:00',
    text: 'Fixed calculator labels that previously only appeared in German or English — the building, hero and research calculators now show their labels in all 15 languages, and numbers respect your language',
  },
  {
    date: '2026-07-09',
    time: '20:35',
    text: 'Research level picker (the pop-up when you tap a node): rows now alternate colour so the lines are easy to tell apart, and the level number sits larger and vertically centered on the left — matching the building calculator style',
  },
  {
    date: '2026-07-09',
    time: '20:05',
    text: 'Research calculator: the horizontal/vertical layout switch is now available on mobile too (open the info panel to switch) — so you can pick a top-to-bottom (vertical) or left-to-right (horizontal) tree. The default stays vertical',
  },
  {
    date: '2026-07-03',
    time: '17:50',
    text: 'The Heroes page is now a hub with tabs: the hero database (shown by default) plus a Hero-EXP calculator. The EXP calculator lives here now — the old standalone tool link redirects to it, or open it directly via Heroes → the "Hero EXP" tab',
  },
  {
    date: '2026-07-03',
    time: '16:10',
    text: 'Hero-EXP calculator: pick your current and target level (up to 175) with live sliders and instantly see the total EXP needed — shown in compact K/M/G notation with the full number and a per-level breakdown. Corrected the level-up cost values',
  },
  {
    date: '2026-07-03',
    time: '14:20',
    text: 'Tank & Research trees now adapt to your screen automatically — the tree scales to fit the width (vertical layout) or height (horizontal layout), stays centered, and recalculates when you resize the window. The manual zoom and arrow buttons are gone (just drag or use the mouse wheel to move around), and the empty space that used to sit below the tree is removed',
  },
  {
    date: '2026-07-03',
    time: '13:00',
    text: 'Tank calculator: the stats panel now matches the Research panel look (blue, consistent width), and its Max-All / Reset-All buttons are stacked full-width',
  },
  {
    date: '2026-07-02',
    time: '22:30',
    text: 'Building & Research sheets: on mobile you can now pull a sheet down by its top handle to close it (before, the content just scrolled). The research info panel also starts collapsed on mobile for more room',
  },
  {
    date: '2026-07-02',
    time: '22:00',
    text: 'Building calculator: added a global Build-Speed setting — a button above the calculator where you enter your base build-speed % plus optional Administrative Commander / Construction-Minister / Rose buff checkboxes (with an in-game how-to and screenshot); every build time then updates live. The matching Capitol buff in the Lab-Speed setting was renamed to "Administrative Commander". Saved to your account (synced when logged in), in 15 languages',
  },
  {
    date: '2026-07-02',
    time: '21:30',
    text: 'Building calculator, completely reworked: a grid of buildings with pictures — tap one to set your current level. Each level shows its upgrade cost, build time, bonuses (colour-coded per bonus) and power, plus the buildings you need first. Buildings that exist multiple times (residences, steel plants, lumberyards, wind turbines …) are listed and numbered individually so the total power adds up correctly. An overview bar shows total power, overall progress % and the resources/time still needed to reach max. Saved to your account (synced when logged in), in 15 languages',
  },
  {
    date: '2026-07-01',
    time: '22:20',
    text: 'Tactical Master tree: Recharge Shield now requires Interceptions, so the Interceptions node connects cleanly into the tree instead of hanging as a dead-end (mirrors the second-tier layout)',
  },
  {
    date: '2026-07-01',
    time: '21:35',
    text: 'Research: everything now focuses on what you still NEED (remaining), not what you spent. The all-trees bar at the top shows the remaining Strom, Zent, Badges and time on one line; the time already spent is left out everywhere because the past Lab-Speed discount is unknown. Node sheets show a remaining-time line, the tree header time row is remaining-only, and the Target lists all four values (Badges, Strom, Zent, remaining time) neatly aligned',
  },
  {
    date: '2026-07-01',
    time: '21:20',
    text: 'Research calculator: on desktop the stats panel now sits on the left (top on mobile) like the tank — with a Lab-Speed button showing your bonus, a neatly aligned Used/Remaining table and coarser values (compact numbers, time without seconds). The horizontal layout now scrolls left/right with the mouse wheel and centers the tree vertically',
  },
  {
    date: '2026-07-01',
    time: '20:45',
    text: 'Research calculator: the header now shows Used and Remaining for Strom, Zent and total research time (with your Lab-Speed applied) — not just badges',
  },
  {
    date: '2026-07-01',
    time: '20:30',
    text: 'Research: added a global Lab-Speed setting (a button on the research overview and inside every node) — enter your base research-speed % plus optional Capitol / Research-Minister / Rose buff checkboxes, with an in-game how-to and screenshot; each node then shows the base time struck through next to the real time. Saved to your account (synced when logged in), in 15 languages',
  },
  {
    date: '2026-07-01',
    time: '20:15',
    text: 'Research: the level picker now shows the research time per level (and a cumulative total), with a Lab-Speed field — enter your research-speed bonus % to see the real duration',
  },
  {
    date: '2026-07-01',
    time: '20:00',
    text: 'Research: corrected the prerequisites and required levels across all trees — the target (badges-to-reach) calculation is now accurate, so a node deeper in a tree always costs more than an earlier one (fixes cases like Age of Steel where a late node showed a lower cost than an earlier one)',
  },
  {
    date: '2026-07-01',
    time: '19:45',
    text: 'Research overview: added a summary bar in the header showing how much Strom, Zent and Badges you have already spent across ALL trees vs the grand total needed to complete every tree',
  },
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
