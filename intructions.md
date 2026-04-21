FINAL POWER TABLE SYSTEM (FULL MERGE + ALL FEATURES)
🎯 OBJECTIVE
Refactor and merge:
•	(SetupTable.js) 
•	(Table.js) 
Into:
✅ ONE Table.js (single source of truth)
With ALL features:
•	Simple table (Setup behavior) 
•	Advanced table (filters, pagination, etc.) 
•	Batch edit system 
•	Drag & drop system 
•	Action column system 
•	Context menu + side panel 
•	Column resizing / visibility 
•	Search + filters 
________________________________________
🚨 CORE RULE (NON-NEGOTIABLE)
ONE TABLE COMPONENT
ZERO duplicated logic
ALL FEATURES BUILT-IN BUT TOGGLABLE
________________________________________
🧠 FINAL API (MERGED)
export default function Table({
  data = [],              // replaces rows/data (unified)
  columns = [],
  rowIdKey = "id",

  // selection / click
  selectedRowId = null,
  onRowClick,

  // actions
  actions = [],
  showActionColumn = true,

  // batch
  batchMode = false,
  onBatchChange,
  onBatchSave,

  // drag
  draggable = false,
  onReorder,

  // data table features
  state,
  filterConfig = [],
  onChange,

  // UI
  loading = false,
  className = "",
  emptyMessage = "No records found.",
})
________________________________________
🔥 BATCH SYSTEM (FINAL)
🧱 RULE
NO API CALLS during edit/delete/create
________________________________________
ROW STATE
__batchState:
  "none" | "created" | "updated" | "deleted"
________________________________________
SAVE FLOW
await onBatchSave({
  created: [{ tempId, data }],
  updated: [{ id, data }],
  deleted: [{ id }]
})
________________________________________
CANCEL FLOW
Table MUST:
•	restore original dataset 
•	clear all batch states 
•	remove created rows 
________________________________________
🚨 REMOVE DUPLICATION
These functions appear in BOTH files → KEEP ONE:
•	normalizeBatchType 
•	resolveNextBatchState 
•	resolveBatchClassName 
________________________________________
🔥 DRAG SYSTEM (FINAL)
RULE
draggable === true && typeof onReorder === "function"
________________________________________
BEHAVIOR
•	Reorder LOCAL dataset only 
•	Update order field 
•	Mark affected rows as updated 
•	NO API CALL 
________________________________________
🚨 CRITICAL
After reorder:
row.order = newIndex + 1
________________________________________
🔥 ACTION SYSTEM
Use:
•	(ActionColumn) 
________________________________________
RULE
•	1 action → inline 
•	2+ → dropdown 
AUTO handled
________________________________________
TABLE RESPONSIBILITY
Intercept:
if (batchMode)
  → update __batchState
else
  → call action.onClick
________________________________________
🔥 REMOVE BROKEN IMPLEMENTATIONS
❌ FROM SetupTable
•	inline drag + batch logic duplication 
•	fixed width: 
width: 140 ❌
________________________________________
❌ FROM Table
•	duplicate batch logic 
•	fixed: 
ACTION_COLUMN_WIDTH ❌
________________________________________
🔥 ACTION COLUMN WIDTH FIX
.psb-ui-table-actions-cell,
.psb-ui-table-actions-header {
  width: 1%;
  white-space: nowrap;
}
________________________________________
🔥 MERGE RULES (CRITICAL)
1. DATA SOURCE
const dataset = Array.isArray(data) ? data : []
NO separate rows vs data
________________________________________
2. RENDER ENGINE
Merge:
•	SortableBodyRow 
•	StaticRow 
•	Table row renderer 
→ ONE unified row renderer
________________________________________
3. DRAG INTEGRATION
From SetupTable:
•	DndContext 
•	SortableContext 
Inject into Table
________________________________________
4. FILTER SYSTEM
Use:
•	(filterSchema.js) 
DO NOT rewrite
________________________________________
5. CONTEXT + SIDE PANEL
Use:
•	
•	
________________________________________
🧪 VALIDATION CHECKLIST
Batch
•	No API calls before save 
•	Cancel fully restores state 
•	Payload structure correct 
________________________________________
Drag
•	Reorders correctly 
•	Updates order field 
•	No API calls 
________________________________________
Action Column
•	No multiple inline buttons 
•	Dropdown works 
________________________________________
Layout
•	No fixed width action column 
•	Table not cramped 
________________________________________
Architecture
•	SetupTable removed 
•	No duplicate functions 
•	One Table component only 
________________________________________
🚫 DO NOT
•	Keep SetupTable 
•	Duplicate batch logic 
•	Use DOM IDs for save 
•	Let modules override cancel 
•	Mix drag logic into batch logic 
________________________________________
🔥 FINAL RULE
If after implementation:
•	You still have duplicated batch logic 
•	Or action column still fixed width 
•	Or drag triggers API 
→ FAIL
________________________________________
💣 STRAIGHT TRUTH
You are now building:
A system-level component, not just a table
If done right:
•	Every module becomes faster to build 
•	UI stays consistent 
•	jr devs can’t break behavior easily 
If done wrong:
•	This becomes your biggest technical debt

🎯 OBJECTIVE
Build a single unified Table.js that:
•	Combines: 
o	(SetupTable) 
o	(Table) 
•	Uses internal feature files to avoid mess 
________________________________________
🧱 FINAL FILE STRUCTURE (MANDATORY)
/table/
  Table.js                    ✅ ONLY public component

  tableBatchEdit.js           ✅ batch logic (CREATE/UPDATE/DELETE)
  tableDragNDrop.js           ✅ drag system
  tableActions.js             ✅ action handler (batch + normal)
  tableRender.js              ✅ row + cell renderer
  tableColumns.js             ✅ column normalization + sizing
  tableState.js               ✅ pagination, sorting, filters

  tableUtils.js               ✅ shared helpers

  tableContextMenu.js         (wrap existing)
  tableSidePanel.js           (wrap existing)
________________________________________
🚨 CORE RULE
Table.js CONTROLS everything
Feature files EXECUTE logic
________________________________________
🧠 HOW TABLE.js SHOULD WORK
Inside Table.js:
const batch = useTableBatchEdit(...)
const drag = useTableDragNDrop(...)
const actions = useTableActions(...)
const render = useTableRender(...)
const tableState = useTableState(...)
Then:
return renderTable({
  batch,
  drag,
  actions,
  tableState
})
________________________________________
🔥 FEATURE MODULE RESPONSIBILITIES
________________________________________
🧱 1. tableBatchEdit.js
Handles:
•	__batchState 
•	batch tracking 
•	save payload generation 
•	cancel (restore original) 
MUST EXPORT:
useTableBatchEdit({
  data,
  onBatchChange,
  onBatchSave
})
________________________________________
🧱 2. tableDragNDrop.js
From SetupTable ()
Handles:
•	DndContext 
•	SortableContext 
•	row reordering 
MUST:
•	update order 
•	integrate with batch system 
________________________________________
🧱 3. tableActions.js
Uses:
•	(ActionColumn) 
Handles:
handleAction({ action, row })
RULE:
if (batchMode)
  → update batch state
else
  → action.onClick()
________________________________________
🧱 4. tableRender.js
Handles:
•	row rendering 
•	drag vs static rows 
•	action column rendering 
MUST:
•	apply batch classes 
•	support drag + non-drag 
________________________________________
🧱 5. tableState.js
From:
•	
Handles:
•	pagination 
•	filters 
•	sorting 
•	search 
________________________________________
🧱 6. tableColumns.js
Handles:
•	column normalization 
•	width 
•	visibility 
________________________________________
🔥 CRITICAL SYSTEM RULES
________________________________________
1. NO DUPLICATION
These MUST exist only once:
•	resolveBatchState 
•	normalizeBatchType 
•	action handling 
•	row rendering 
________________________________________
2. ACTION COLUMN
Use:
•	
Rules:
•	1 action → inline 
•	2+ → dropdown 
________________________________________
3. ACTION COLUMN WIDTH
REMOVE:
•	❌ width: 140 
•	❌ ACTION_COLUMN_WIDTH 
USE:
width: 1%;
white-space: nowrap;
________________________________________
4. BATCH MODE
•	no API calls until save 
•	cancel = full revert 
•	payload must be structured 
________________________________________
5. DRAG MODE
•	local reorder only 
•	update order 
•	integrate with batch 
________________________________________
🧪 VALIDATION CHECKLIST
•	Only ONE Table component 
•	SetupTable deleted 
•	No duplicated batch logic 
•	Drag works with batch 
•	Save payload correct 
•	Action column responsive 
•	Filters + pagination still work 
________________________________________
🚫 DO NOT
•	create multiple table components 
•	inline everything into Table.js 
•	duplicate logic across files 
•	let modules bypass table system 
________________________________________
🔥 FINAL RULE
If:
•	Table.js becomes huge AND messy
→ ❌ you failed structure 
If:
•	features are split but disconnected
→ ❌ you failed integration 
________________________________________
💣 STRAIGHT TRUTH
What you’re building is:
a framework-level UI component
Not just a table.

