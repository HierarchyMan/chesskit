import { Chess } from "chess.js";
import { atom } from "jotai";

export const openingGameAtom = atom(new Chess());
