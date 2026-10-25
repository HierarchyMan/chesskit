import { Chess } from "chess.js";

export interface StudyNode {
  id: string;
  parent?: string;
  uci?: string;
  san?: string;
  children: string[];
  annotations: string[];
}
export interface StudyTree {
  rootFen: string;
  nodes: Record<string, StudyNode>;
}
export interface StudyPath {
  endpoint: string;
  headers: Record<string, string>;
  annotations: Record<string, string[]>;
}

// Identity includes the complete parent path, never just the resulting FEN.
// Two transpositions therefore remain distinct occurrences in a study.
const edgeId = (parent: string, uci: string) => {
  const text = `${parent}/${uci}`;
  let a = 2166136261;
  let b = 2246822507;
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 16777619);
    b = Math.imul(b ^ text.charCodeAt(i), 3266489909);
  }
  return `n${(a >>> 0).toString(36)}_${(b >>> 0).toString(36)}`;
};
export const emptyStudyTree = (rootFen: string): StudyTree => ({
  rootFen,
  nodes: { root: { id: "root", children: [], annotations: [] } },
});
export const addStudyMove = (
  tree: StudyTree,
  parent: string,
  game: Chess,
  san: string
) => {
  const move = game.move(san);
  const uci = `${move.from}${move.to}${move.promotion ?? ""}`;
  const id = edgeId(parent, uci);
  const existing = tree.nodes[id];
  if (existing && (existing.parent !== parent || existing.uci !== uci))
    throw new Error("Study move identity collision.");
  if (!existing) {
    tree.nodes[id] = {
      id,
      parent,
      uci,
      san: move.san,
      children: [],
      annotations: [],
    };
    tree.nodes[parent].children.push(id);
  }
  return id;
};

export const studyNodePath = (
  tree: StudyTree,
  endpoint: string
): StudyNode[] => {
  const path: StudyNode[] = [];
  const visited = new Set<string>();
  let node = tree.nodes[endpoint];
  if (!node) throw new Error("Unknown study position.");
  while (node.parent) {
    if (visited.has(node.id)) throw new Error("Cyclic study path.");
    visited.add(node.id);
    path.push(node);
    node = tree.nodes[node.parent];
    if (!node) throw new Error("Missing study parent.");
  }
  if (node.id !== "root") throw new Error("Invalid study root.");
  return path.reverse();
};

export const studyPathGame = (tree: StudyTree, path: StudyPath): Chess => {
  const game = new Chess(tree.rootFen);
  for (const [key, value] of Object.entries(path.headers))
    game.setHeader(key, value);
  const comment = (id: string) => {
    const comments = (path.annotations[id] ?? []).filter((value) =>
      value.startsWith("{")
    );
    if (comments.length)
      game.setComment(comments.map((value) => value.slice(1, -1)).join("\n"));
  };
  comment("root");
  for (const node of studyNodePath(tree, path.endpoint)) {
    game.move(node.uci!);
    comment(node.id);
  }
  return game;
};

/** Parse recursive annotation variations, validating every move against its own parent. */
const parseUncachedStudyPgn = (
  text: string
): { tree: StudyTree; main: StudyPath; variations: StudyPath[] } => {
  if (text.length > 20_000_000) throw new Error("The PGN is too large.");
  let remaining = text.replace(/^\uFEFF/, "").trim();
  const headers: Record<string, string> = {};
  const tag = /^\[\s*(\w+)\s+"((?:\\.|[^"\\])*)"\s*\]\s*/;
  while (remaining.startsWith("[")) {
    const match = remaining.match(tag);
    if (!match) throw new Error("Invalid PGN header.");
    headers[match[1]] = match[2].replace(/\\([\\"])/g, "$1");
    remaining = remaining.slice(match[0].length);
  }
  const root = new Chess(headers.FEN);
  const tree = emptyStudyTree(root.fen());
  const tokens =
    remaining.match(/\{[^}]*\}|;[^\r\n]*|\(|\)|\$\d+|[^\s(){};]+/g) ?? [];
  const variations: StudyPath[] = [];
  let cursor = 0;
  const parseLine = (
    start: string,
    startFen: string,
    nested: boolean
  ): StudyPath => {
    const game = new Chess(startFen);
    let current = start;
    let previous = start;
    let beforeMoveFen = startFen;
    const annotations: Record<string, string[]> = {};
    let result = "*";
    while (cursor < tokens.length) {
      let token = tokens[cursor++];
      if (token === ")") {
        if (!nested) throw new Error("Unexpected PGN variation ending.");
        return {
          endpoint: current,
          headers: { ...headers, Result: result },
          annotations,
        };
      }
      if (token === "(") {
        const variation = parseLine(previous, beforeMoveFen, true);
        variations.push(variation);
        continue;
      }
      if (
        token.startsWith("{") ||
        token.startsWith(";") ||
        token.startsWith("$")
      ) {
        if (token.startsWith(";")) token = `{${token.slice(1)}}`;
        (annotations[current] ??= []).push(token);
        if (!tree.nodes[current].annotations.includes(token))
          tree.nodes[current].annotations.push(token);
        continue;
      }
      if (/^(1-0|0-1|1\/2-1\/2|\*)$/.test(token)) {
        result = token;
        continue;
      }
      token = token.replace(/^\d+\.(?:\.\.)?/, "");
      if (!token || /^\.+$/.test(token) || /^e\.p\.$/i.test(token)) continue;
      const suffix = token.match(/([!?]+)$/)?.[1];
      token = token.replace(/[!?]+$/, "");
      previous = current;
      beforeMoveFen = game.fen();
      current = addStudyMove(tree, current, game, token);
      if (suffix) {
        const nag = (
          {
            "!": "$1",
            "?": "$2",
            "!!": "$3",
            "??": "$4",
            "!?": "$5",
            "?!": "$6",
          } as Record<string, string>
        )[suffix];
        if (nag) {
          (annotations[current] ??= []).push(nag);
          tree.nodes[current].annotations.push(nag);
        }
      }
    }
    if (nested) throw new Error("Unclosed PGN variation.");
    return {
      endpoint: current,
      headers: { ...headers, Result: headers.Result ?? result },
      annotations,
    };
  };
  const main = parseLine("root", root.fen(), false);
  // Variations inherit comments on the shared prefix, but keep their own overrides.
  for (const line of variations) {
    for (const node of [
      tree.nodes.root,
      ...studyNodePath(tree, line.endpoint),
    ]) {
      line.annotations[node.id] ??= main.annotations[node.id] ?? [];
    }
  }
  return { tree, main, variations };
};

const compiledStudies = new Map<
  string,
  ReturnType<typeof parseUncachedStudyPgn>
>();
let compiledCharacters = 0;
const compiledStudy = (text: string) => {
  const cached = compiledStudies.get(text);
  if (cached) return cached;
  const parsed = parseUncachedStudyPgn(text);
  if (text.length <= 1_000_000) {
    compiledStudies.set(text, parsed);
    compiledCharacters += text.length;
    while (compiledStudies.size > 256 || compiledCharacters > 8_000_000) {
      const key = compiledStudies.keys().next().value!;
      compiledStudies.delete(key);
      compiledCharacters -= key.length;
    }
  }
  return parsed;
};
export const parseStudyPgn = (text: string) =>
  structuredClone(compiledStudy(text));

export const addStudyPath = (tree: StudyTree, pgn: string): StudyPath => {
  const parsed = compiledStudy(pgn);
  if (parsed.tree.rootFen !== tree.rootFen)
    throw new Error("Study paths have different starting positions.");
  let endpoint = "root";
  // Each compiled path has already passed the rules validator. Reusing its
  // edges avoids replaying every common prefix again on every cursor save.
  for (const node of studyNodePath(parsed.tree, parsed.main.endpoint)) {
    const existing = tree.nodes[node.id];
    if (
      existing &&
      (existing.parent !== node.parent || existing.uci !== node.uci)
    )
      throw new Error("Study move identity collision.");
    if (!existing) {
      tree.nodes[node.id] = { ...node, children: [], annotations: [] };
      tree.nodes[endpoint].children.push(node.id);
    }
    endpoint = node.id;
  }
  for (const [id, annotations] of Object.entries(parsed.main.annotations)) {
    for (const value of annotations)
      if (!tree.nodes[id].annotations.includes(value))
        tree.nodes[id].annotations.push(value);
  }
  return {
    endpoint,
    headers: { ...parsed.main.headers },
    annotations: Object.fromEntries(
      Object.entries(parsed.main.annotations).map(([id, annotations]) => [
        id,
        [...annotations],
      ])
    ),
  };
};

export const studyFromGame = (
  game: Chess
): { tree: StudyTree; main: StudyPath } => {
  const history = game.history({ verbose: true });
  const tree = emptyStudyTree(history[0]?.before ?? game.fen());
  const replay = new Chess(tree.rootFen);
  const comments = new Map(
    game.getComments().map(({ fen, comment }) => [fen, comment])
  );
  const main: StudyPath = {
    endpoint: "root",
    headers: game.getHeaders(),
    annotations: {},
  };
  const annotate = (id: string) => {
    const comment = comments.get(replay.fen());
    if (comment !== undefined) {
      main.annotations[id] = [`{${comment}}`];
      tree.nodes[id].annotations = [`{${comment}}`];
    }
  };
  annotate("root");
  for (const move of history) {
    main.endpoint = addStudyMove(tree, main.endpoint, replay, move.lan);
    annotate(main.endpoint);
  }
  return { tree, main };
};

const escapeTag = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
const headerText = (headers: Record<string, string>) =>
  Object.entries(headers)
    .map(([key, value]) => `[${key} "${escapeTag(value)}"]`)
    .join("\n");
const moveText = (game: Chess, node: StudyNode) => {
  const fields = game.fen().split(" ");
  const prefix = `${fields[5]}${game.turn() === "w" ? "." : "..."}`;
  const move = game.move(node.uci!);
  return `${prefix} ${move.san}`;
};

/** A single selected path, preserving NAGs/comments and Black-root numbering. */
export const writeStudyPath = (tree: StudyTree, path: StudyPath): string => {
  if (
    !Object.values(path.annotations).some((values) =>
      values.some((value) => value.startsWith("$"))
    )
  ) {
    // chess.js formats movetext well, but does not escape header values on output.
    const pgn = studyPathGame(tree, path).pgn();
    const body = pgn.slice(pgn.lastIndexOf("]\n") + 2);
    return `${headerText(path.headers)}\n${body}`;
  }
  const game = new Chess(tree.rootFen);
  const tokens = [...(path.annotations.root ?? [])];
  for (const node of studyNodePath(tree, path.endpoint)) {
    tokens.push(moveText(game, node), ...(path.annotations[node.id] ?? []));
  }
  return `${headerText(path.headers)}\n\n${tokens.join(" ")} ${path.headers.Result ?? "*"}`.trim();
};

/** All children are emitted at their actual fork, rather than as duplicated games. */
export const writeStudyTree = (
  tree: StudyTree,
  headers: Record<string, string>
): string => {
  const emit = (parent: string, game: Chess): string => {
    const children = tree.nodes[parent].children;
    if (!children.length) return "";
    const branch = (id: string, board: Chess) => {
      const node = tree.nodes[id];
      const text = [moveText(board, node), ...node.annotations];
      const rest = emit(id, board);
      if (rest) text.push(rest);
      return text.join(" ");
    };
    const first = tree.nodes[children[0]];
    const before = game.fen();
    const tokens = [moveText(game, first), ...first.annotations];
    for (const child of children.slice(1))
      tokens.push(`(${branch(child, new Chess(before))})`);
    const rest = emit(first.id, game);
    if (rest) tokens.push(rest);
    return tokens.join(" ");
  };
  return `${headerText(headers)}\n\n${tree.nodes.root.annotations.join(" ")} ${emit("root", new Chess(tree.rootFen))} ${headers.Result ?? "*"}`.trim();
};
