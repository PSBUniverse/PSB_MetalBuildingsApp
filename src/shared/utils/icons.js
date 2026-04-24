/**
 * Centralized icon registry — maps legacy Bootstrap-Icon string names
 * to Font Awesome icon definitions.
 *
 * Every icon used anywhere in the app should be registered here so that
 * string-based icon references (stored in the database, action configs, etc.)
 * resolve to the correct Font Awesome icon.
 */

import {
  faSort,
  faSortUp,
  faSortDown,
  faBan,
  faBucket,
  faCheck,
  faChevronDown,
  faChevronUp,
  faEnvelope,
  faGripVertical,
  faLayerGroup,
  faListCheck,
  faPen,
  faPenToSquare,
  faPhone,
  faPlus,
  faRotateLeft,
  faShieldHalved,
  faTableCellsLarge,
  faTrash,
  faEllipsisVertical,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";

import {
  faEye,
  faEyeSlash,
  faFloppyDisk,
  faCircleCheck,
  faCircleXmark,
} from "@fortawesome/free-regular-svg-icons";

/**
 * Map of string icon names to FA icon objects.
 * Keys cover both the "bi-xxx" form and the bare "xxx" form used in action configs.
 */
const ICON_MAP = Object.freeze({
  // Sort
  "arrow-down-up": faSort,
  "bi-arrow-down-up": faSort,
  "sort-up": faSortUp,
  "bi-sort-up": faSortUp,
  "sort-down": faSortDown,
  "bi-sort-down": faSortDown,

  // Chevrons
  "chevron-down": faChevronDown,
  "bi-chevron-down": faChevronDown,
  "chevron-up": faChevronUp,
  "bi-chevron-up": faChevronUp,

  // Actions / CRUD
  "pencil-square": faPen,
  "bi-pencil-square": faPen,
  "pencil": faPen,
  "bi-pencil": faPen,
  "pen": faPen,
  "edit": faPen,
  "trash": faTrash,
  "bi-trash": faTrash,
  "delete": faTrash,
  "ban": faBan,
  "deactivate": faBan,
  "plus-lg": faPlus,
  "bi-plus-lg": faPlus,
  "plus": faPlus,
  "add": faPlus,
  "eye": faEye,
  "bi-eye": faEye,
  "preview": faEye,
  "eye-slash": faEyeSlash,
  "bi-eye-slash": faEyeSlash,
  "save": faFloppyDisk,
  "floppy-disk": faFloppyDisk,
  "restore": faRotateLeft,
  "rotate-left": faRotateLeft,
  "cancel": faXmark,
  "xmark": faXmark,

  // Status / feedback
  "check2": faCheck,
  "bi-check2": faCheck,
  "check-circle": faCircleCheck,
  "bi-check-circle": faCircleCheck,
  "slash-circle": faBan,
  "bi-slash-circle": faBan,
  "x-octagon": faCircleXmark,
  "bi-x-octagon": faCircleXmark,
  "x-circle": faCircleXmark,
  "bi-x-circle": faCircleXmark,
  "x-lg": faXmark,
  "bi-x-lg": faXmark,

  // Dashboard / cards
  "grid-3x3-gap": faTableCellsLarge,
  "bi-grid-3x3-gap": faTableCellsLarge,
  "collection": faLayerGroup,
  "bi-collection": faLayerGroup,
  "card-list": faListCheck,
  "bi-card-list": faListCheck,

  // Contact
  "envelope-at-fill": faEnvelope,
  "bi-envelope-at-fill": faEnvelope,
  "telephone-fill": faPhone,
  "bi-telephone-fill": faPhone,

  // Misc
  "grip-vertical": faGripVertical,
  "bi-grip-vertical": faGripVertical,
  "three-dots-vertical": faEllipsisVertical,
  "bi-three-dots-vertical": faEllipsisVertical,
  "shield-lock": faShieldHalved,
  "bi-shield-lock": faShieldHalved,
  "bucket": faBucket,
  "bi-bucket": faBucket,
});

/**
 * Resolve a string icon name to a Font Awesome icon definition.
 * Returns `null` when the name is empty or not mapped.
 *
 * @param {string} name  Bootstrap-icon style name, with or without "bi-" prefix.
 * @returns {import("@fortawesome/fontawesome-svg-core").IconDefinition | null}
 */
export function resolveIcon(name) {
  const key = String(name || "").trim();
  if (!key) return null;
  return ICON_MAP[key] || null;
}
