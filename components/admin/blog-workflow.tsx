import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { transitionBlog } from "@/lib/admin/actions";
import { utcLabel } from "@/lib/admin/ui";
import type { BlogPost } from "@/lib/blog/schema";
import type { Locale } from "@/i18n/config";

export async function BlogWorkflow({ locale, post, publish, revisions }: {
  locale: Locale; post: BlogPost; publish: boolean; revisions: { revision: number; created_at: string }[];
}) {
  const t = await getTranslations({ locale, namespace: "admin" });
  const action = transitionBlog.bind(null, locale, post.id, post.revision);
  return <section className="studio-flow">
    <h2>{t("workflow")}</h2>
    <p>{t(post.status)}</p>
    {post.scheduled_at && <p>{t("scheduledDate", { time: utcLabel(locale, post.scheduled_at) })}</p>}
    {post.status === "draft" && <form action={action} className="studio-form">
      <Button type="submit" name="operation" value="review" variant="outline">{t("reviewAction")}</Button>
    </form>}
    {publish && (post.status === "review" || post.status === "scheduled") && <form action={action} className="studio-form">
      <div className="field">
        <label htmlFor="post-schedule">{t("scheduleTime")}</label>
        <Input id="post-schedule" name="schedule" type="datetime-local" aria-describedby="schedule-help" />
        <p className="studio-meta" id="schedule-help">{t("scheduleHelp")}</p>
      </div>
      <label className="studio-confirm"><input type="checkbox" name="confirm" required />{t("confirm")}</label>
      <div className="studio-actions">
        <Button type="submit" name="operation" value="publish">{t("publishAction")}</Button>
        <Button type="submit" name="operation" value="schedule" variant="outline">{t("scheduleAction")}</Button>
      </div>
    </form>}
    {publish && post.status !== "archived" && <form action={action} className="studio-form">
      <label className="studio-confirm"><input type="checkbox" name="confirm" required />{t("confirm")}</label>
      {post.status === "published" || post.status === "scheduled"
        ? <Button type="submit" name="operation" value="unpublish" variant="outline">{t("unpublishAction")}</Button>
        : <Button type="submit" name="operation" value="archive" variant="outline">{t("archiveAction")}</Button>}
    </form>}
    <h2>{t("revisions")}</h2>
    {revisions.length > 0 ? <ul className="studio-history">{revisions.map((entry) =>
      <li key={entry.revision}>{t("revision", { number: entry.revision })} <span className="studio-meta">{utcLabel(locale, entry.created_at)} UTC</span></li>
    )}</ul> : <p>{t("empty")}</p>}
    {publish && revisions.length > 0 && (post.status === "draft" || post.status === "review" || post.status === "archived") &&
      <form action={action} className="studio-form">
        <div className="field">
          <label htmlFor="restore-version">{t("historyChoice")}</label>
          <select className="input" name="revision" id="restore-version" defaultValue={revisions[0].revision}>
            {revisions.map((entry) => <option key={entry.revision} value={entry.revision}>
              {t("revision", { number: entry.revision })} ({utcLabel(locale, entry.created_at)} UTC)
            </option>)}
          </select>
        </div>
        <label className="studio-confirm"><input type="checkbox" name="confirm" required />{t("confirm")}</label>
        <Button type="submit" name="operation" value="restore" variant="outline">{t("restoreAction")}</Button>
      </form>}
  </section>;
}
