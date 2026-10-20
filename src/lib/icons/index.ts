import { IconifyJSON, addCollection } from "@iconify/react";
import iconData from "./iconData.json";

(iconData as unknown as IconifyJSON[]).forEach((collection) =>
  addCollection(collection)
);
