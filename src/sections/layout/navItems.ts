export type NavGroup = "Play" | "Learn" | "Tools";

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: string;
  group?: NavGroup;
  description: string;
  accent: string;
}

export const HOME_ITEM: NavItem = {
  id: "home",
  label: "Home",
  href: "/",
  icon: "mdi:home-outline",
  description: "Your chess hub",
  accent: "#3B9AC6",
};

export const NAV_ITEMS: NavItem[] = [
  {
    id: "play",
    label: "Play",
    href: "/play",
    icon: "mdi:chess-pawn",
    group: "Play",
    description: "Play a bot at any strength, with hints and undo in casual games",
    accent: "#3B9AC6",
  },
  {
    id: "arena",
    label: "Engine Arena",
    href: "/arena",
    icon: "mdi:sword-cross",
    group: "Play",
    description: "Watch two engines play and step in whenever you like",
    accent: "#e0793b",
  },
  {
    id: "learn",
    label: "Learn",
    href: "/learn",
    icon: "mdi:school-outline",
    group: "Learn",
    description: "A coach that explains moves and shows where they lead",
    accent: "#22ac38",
  },
  {
    id: "puzzles",
    label: "Puzzles",
    href: "/puzzles",
    icon: "mdi:puzzle-outline",
    group: "Learn",
    description: "Tactics from Lichess, or from the mistakes in your own games",
    accent: "#a06bd6",
  },
  {
    id: "openings",
    label: "Openings",
    href: "/openings",
    icon: "mdi:book-open-page-variant-outline",
    group: "Learn",
    description: "Learn and drill the main opening lines with their ideas",
    accent: "#dbac86",
  },
  {
    id: "endgames",
    label: "Endgames",
    href: "/endgames",
    icon: "mdi:chess-king",
    group: "Learn",
    description: "Practise the key endgames against the engine",
    accent: "#19d4af",
  },
  {
    id: "vision",
    label: "Board Vision",
    href: "/vision",
    icon: "mdi:eye-outline",
    group: "Learn",
    description: "Train square names and knight routes",
    accent: "#f2be1f",
  },
  {
    id: "analysis",
    label: "Analysis",
    href: "/analysis",
    icon: "mdi:chart-line",
    group: "Tools",
    description: "Review any game: paste a PGN, link or load from Lichess",
    accent: "#3894eb",
  },
  {
    id: "editor",
    label: "Board Editor",
    href: "/editor",
    icon: "mdi:pencil-ruler",
    group: "Tools",
    description: "Arrange pieces, set up any position, evaluate it live",
    accent: "#df5353",
  },
  {
    id: "scan",
    label: "Scan Image",
    href: "/scan",
    icon: "mdi:image-search-outline",
    group: "Tools",
    description: "Turn a screenshot or photo of a board into a position",
    accent: "#e69f00",
  },
  {
    id: "database",
    label: "Game Database",
    href: "/database",
    icon: "mdi:database-outline",
    group: "Tools",
    description: "Your saved games and their analysis",
    accent: "#74b038",
  },
];

export const NAV_GROUPS: NavGroup[] = ["Play", "Learn", "Tools"];

export const isNavItemActive = (item: NavItem, pathname: string): boolean =>
  item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

export const findNavItem = (pathname: string): NavItem | undefined =>
  [HOME_ITEM, ...NAV_ITEMS].find((item) => isNavItemActive(item, pathname));
