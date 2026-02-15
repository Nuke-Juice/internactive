You are inside the Internactive repo. DO NOT output a plan-only document.
MAKE CODE CHANGES in the repository and commit them.

Context:
Student signup step ("/signup/student/details", Step 2 of 4) shows a "Skills and coursework" field.
Right now the coursework selector renders a large scrollable list INSIDE the form area (looks like an embedded listbox).
We want a normal input with a dropdown (combobox/typeahead) that feels modern and matches the canonical majors combobox UX.

GOALS (ship all of these):
1) Replace the coursework UI with a real typeahead combobox dropdown:
   - Input only (no big always-visible list)
   - Dropdown appears on focus + typing (>= 2 chars)
   - Shows max 10 results (scroll inside dropdown only)
   - Keyboard support: Up/Down to navigate, Enter selects, Esc closes, Tab keeps normal behavior
   - Click outside closes
   - Selected items render as removable chips below (keep current chip UI if already exists)

2) Course search scope:
   - Default search is "Your university" (current behavior is fine)
   - Add an explicit small toggle/link under the input:
       "Searching: <University Name>" + a secondary action "Search all"
     Behavior:
       - Default: results come from the student's selected university
       - When "Search all" is enabled, search across all courses (or all available course dataset)
       - Preserve the current university-tuned suggestions but don't trap users if the course isn't found

3) "Can't find it? Add a course" escape hatch (controlled custom entry):
   - If there are zero dropdown results for the typed query, show a dropdown row:
       "Add '<typed text>'"
   - When clicked/Enter:
       - Add it as a chip
       - Store it as unverified in the student profile payload (do NOT pollute canonical course list)
   - Data model approach:
       - If student profile currently stores coursework as strings, store custom exactly as string and additionally store a boolean "coursework_unverified" array/object OR store as objects { label, verified }.
       - If student profile stores IDs, introduce a parallel storage field for custom courses, e.g. `custom_coursework text[]`.
   - Keep the backend compatible and do not break existing profiles.

4) Second major field:
   - Replace plain text input with the same canonical Major combobox component used elsewhere.
   - Store canonical major_id for second major (or store second_major_id).
   - If schema does not have it, add migration and update RLS/policies consistently.

5) Copy + layout polish:
   - Replace "Search coursework and press Enter to add" with:
       Placeholder: "Search courses (e.g., ACC 2110, Accounting, Finance)"
       Helper: "Start typing to see matches. Can't find it? Add it."
   - Remove the separate "Add" button next to the input (selection via dropdown or Enter).
   - Keep spacing consistent with the rest of the step.
   - Ensure the dropdown does not push the page layout down (overlay/popover).

6) Data retrieval / filtering:
   - Identify where course options come from now (likely a query based on selected university).
   - Ensure the search is not artificially limited to a tiny list; implement server-side query with `ilike` on course code + title.
   - Add support for searching by code or title (ACC 2110, Principles, Accounting).
   - If there are alias issues (ACC vs ACCTG), implement simple normalization:
       - normalize input by removing spaces and uppercasing for code matching
       - also search title via ilike
   - Limit results to 10, order by:
       - code prefix match first
       - then title match
       - then alphabetical

7) Accessibility:
   - Follow standard combobox behavior (WAI-ARIA APG style):
       - input remains focused while navigating options
       - aria-expanded, aria-controls, aria-activedescendant (or use an existing accessible component library already in repo)
   - If the project already uses shadcn/ui or a Command/Popover pattern, use that rather than inventing a custom widget.
   - Avoid Radix DropdownMenu typeahead conflicts; use a proper combobox/autocomplete approach.

IMPLEMENTATION NOTES:
- Prefer building a reusable `CourseworkCombobox` component under /components similar to MajorCombobox.
- If already using shadcn/ui: use Popover + Command pattern (search + selectable list) for the dropdown and chips for selections.
- Ensure the selected list can be multiple.
- Ensure state persists across navigation (if the form is multi-step with local state).
- If there’s validation, keep it: optional but recommended, not required.

FILES:
- Update the student details step page/component where the coursework field is rendered.
- Add/modify any server actions or Supabase queries used to fetch course results.
- Add migration(s) only if required for second_major_id or custom_coursework storage.
- Update types and profile save logic accordingly.

ACCEPTANCE CRITERIA:
- The big inline list is gone.
- Typing shows a dropdown of up to 10 matching courses.
- Selecting adds chips; chips removable.
- "Search all" toggle works.
- "Add '<typed text>'" appears when no results and adds an unverified chip saved to profile.
- Second major uses canonical major picker.
- No console errors; npm run build passes.
- Commit changes with message: "Student details UX: coursework combobox + second major picker"

After implementing, run lint/build and fix issues before committing.
