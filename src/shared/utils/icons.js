/**
 * Centralized icon registry — maps string names to Font Awesome icon
 * definitions.
 *
 * Every icon used anywhere in the app should be registered here so that
 * string-based icon references (stored in the database, action configs, etc.)
 * resolve to the correct Font Awesome icon.
 */

import {
  faBan,
  faBook,
  faBox,
  faBucket,
  faBuilding,
  faCheck,
  faChevronDown,
  faChevronLeft,
  faChevronRight,
  faChevronUp,
  faCircleUser,
  faClockRotateLeft,
  faCode,
  faDatabase,
  faEllipsisVertical,
  faEnvelope,
  faGear,
  faGraduationCap,
  faGripVertical,
  faLayerGroup,
  faListCheck,
  faPalette,
  faPen,
  faPhone,
  faPlus,
  faRightToBracket,
  faRocket,
  faRotateLeft,
  faShieldHalved,
  faSignsPost,
  faSitemap,
  faSort,
  faSortDown,
  faSortUp,
  faTableCells,
  faTableCellsLarge,
  faTags,
  faTrash,
  faUsers,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";

import {
  faCircleCheck,
  faCircleXmark,
  faEye,
  faEyeSlash,
  faFloppyDisk,
} from "@fortawesome/free-regular-svg-icons";

/**
 * Map of string icon names to FA icon objects.
 * Keys use Font Awesome naming conventions.
 */
const ICON_MAP = Object.freeze({
  // Sort
  "sort": faSort,
  "sort-up": faSortUp,
  "sort-down": faSortDown,

  // Chevrons
  "chevron-down": faChevronDown,
  "chevron-left": faChevronLeft,
  "chevron-right": faChevronRight,
  "chevron-up": faChevronUp,

  // Actions / CRUD
  "pen": faPen,
  "edit": faPen,
  "trash": faTrash,
  "delete": faTrash,
  "ban": faBan,
  "deactivate": faBan,
  "plus": faPlus,
  "eye": faEye,
  "preview": faEye,
  "eye-slash": faEyeSlash,
  "save": faFloppyDisk,
  "floppy-disk": faFloppyDisk,
  "restore": faRotateLeft,
  "rotate-left": faRotateLeft,
  "cancel": faXmark,
  "xmark": faXmark,

  // Status / feedback
  "check": faCheck,
  "circle-check": faCircleCheck,
  "circle-xmark": faCircleXmark,

  // Dashboard / cards
  "table-cells": faTableCells,
  "table-cells-large": faTableCellsLarge,
  "layer-group": faLayerGroup,
  "list-check": faListCheck,

  // Contact
  "envelope": faEnvelope,
  "phone": faPhone,

  // Navigation / system
  "gear": faGear,
  "sitemap": faSitemap,
  "users": faUsers,
  "tags": faTags,
  "circle-user": faCircleUser,
  "code": faCode,
  "right-to-bracket": faRightToBracket,
  "book": faBook,
  "rocket": faRocket,
  "shield-halved": faShieldHalved,
  "palette": faPalette,
  "database": faDatabase,
  "signs-post": faSignsPost,
  "graduation-cap": faGraduationCap,
  "clock-rotate-left": faClockRotateLeft,
  "building": faBuilding,
  "box": faBox,

  // Misc
  "grip-vertical": faGripVertical,
  "ellipsis-vertical": faEllipsisVertical,
  "bucket": faBucket,
});

/**
 * Resolve a string icon name to a Font Awesome icon definition.
 * Returns `null` when the name is empty or not mapped.
 *
 * @param {string} name  Font Awesome icon name (e.g. "pen", "trash", "gear").
 * @returns {import("@fortawesome/fontawesome-svg-core").IconDefinition | null}
 */
export function resolveIcon(name) {
  const key = String(name || "").trim();
  if (!key) return null;
  return ICON_MAP[key] || null;
}
