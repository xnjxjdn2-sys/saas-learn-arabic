<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Student accounts link to student records only via `claim_student_link(link_code)`; triggers block setting `students.user_id` directly. Why: phone matching let anyone take over a student's data.
- `center_manager` role is granted only by `claim_center_manager(code)` against `center_manager_invites` (service-role only); signup metadata can grant teacher/student only. Why: role must not be self-selected from the browser.
- `teachers.center_id` changes to a center only through `respond_join_request` (manager approval); teachers may leave via `leave_center`. A trigger propagates center_id to students/classes. Why: joining a center exposes data to its manager.
