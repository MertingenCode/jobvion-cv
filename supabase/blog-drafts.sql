-- TODO(content-review): review each English draft before publishing.
-- Safe to rerun on a new environment and leaves edited or published rows intact.
with added as (
  insert into public.blog_posts (locale, slug, title, excerpt, body, author, category, tags)
  values
  ('en', 'ats-friendly-resume', 'How to write an ATS-friendly resume',
   'Use clear headings and test whether the text can be read in order before you submit.',
   $article$An applicant tracking system (ATS) may extract text to populate an application record. Start with a document a person can skim. A consistent reading order also gives the parser less to interpret.

## Make the order obvious

Use one column and familiar headings such as Experience, Education and Skills. Put your name and contact details in the document body. Keep job title, company and dates together so they are easy to associate.

Pick a clear date format, such as Mar 2022 to Oct 2024, and use it consistently. Describe each job with a few bullets that show what you did and what changed. Spell out a specialized term once if the posting uses both the full name and its abbreviation.

## Test the exported file

- Copy the entire PDF into a plain-text editor.
- Read it from top to bottom. Make sure each employer is followed by the right dates and bullets.
- Search for your name, email and one relevant skill.
- Check the application form’s accepted file types before uploading.

If the copy is blank, verify that your file contains text. If the order is confusing, remove the layout features that separate related content. Submit the required format and read any fields the form fills automatically.$article$,
   'Jobvion', 'Resume writing', array['ATS','Formatting']),
  ('en', 'tailor-your-cv-to-a-job', 'How to tailor your CV to a job posting',
   'Match evidence from your existing experience to the responsibilities the employer lists.',
   $article$Read the posting once for the role’s purpose, then again for the work you would do. Make a short list of the responsibilities and mark which qualifications are described as required. Use this list to revise your CV.

## Pair each requirement with evidence

Suppose the posting asks for experience explaining product data to nontechnical teams. A useful example might be a weekly report you wrote for operations. Locate the original bullet and make the relevant work easy to see.

- Before: Created weekly reports.
- After, if accurate: Built a weekly returns report and explained its findings to the operations team.

Use the posting’s wording when it accurately describes your work. If you used a similar tool, name the tool you actually used and describe the transferable task. Keep requirements that you cannot support in a separate list for your own review.

## Put the most relevant work first

Within each role, move the strongest relevant bullet near the top. Check that dates and employers still match the original CV. Save a copy labelled with the role and employer. Before you submit, compare that file with the posting once more and make sure every claim is something you can explain in an interview.$article$,
   'Jobvion', 'Applications', array['Tailoring','Job postings']),
  ('en', 'software-developer-resume-examples', 'Software developer resume examples',
   'Write technical bullets that make your contribution, system and outcome clear.',
   $article$A developer’s CV should help the reader understand what changed because of your work. A list of technologies provides context. The experience section should show where you used them and what responsibility you had.

## Show the problem and your contribution

A vague bullet says “Worked on backend APIs.” A more useful example is “Added request validation to the invoice API and wrote integration tests for rejected inputs.” These examples are illustrative. Replace them with details you can verify from your own work.

If a team shipped a large change, identify your part, such as designing the migration, writing a test suite or coordinating the rollout. Name the adjacent system only if it clarifies how the work was used.

## Use metrics you can explain

If you have an authentic baseline and follow-up measurement, include the unit and context. For example, a measured result might report p95 latency for a defined endpoint under a stated workload. Without measured results, state the concrete outcome: a workflow automated, an incident resolved, or an integration delivered.

For an early-career project, explain what the reader can inspect. A short description of the problem, your implementation and how you validated it usually says more than a link and a technology list.$article$,
   'Jobvion', 'Examples', array['Software development','Experience']),
  ('en', 'write-a-cover-letter', 'How to write a cover letter with evidence',
   'Choose one project that connects your experience to the work you would do in the role.',
   $article$Start by asking what the manager will need from the person in the role. Use the posting and the company’s public materials to identify one responsibility that actually interests you. Open with the role and the specific work you want to take on.

## Make one example do the work

Choose a project that shows how you would approach that responsibility. Summarize the situation, your contribution and the outcome in a short paragraph. If you cannot quantify the outcome, name a deliverable or a change you saw.

For a role that involves coordinating launches, an example might describe how you gathered sign-off across design and support, maintained a rollout checklist and wrote release notes. Include only details from your own experience.

## Give the reader a useful closing

Connect the example to what you would bring to the team. Invite a conversation and include your name. Before sending, check the company and role names, remove any generic praise you cannot explain, and read the letter aloud. If the posting makes a cover letter optional, send one when you have a relevant example or context your CV does not cover.$article$,
   'Jobvion', 'Applications', array['Cover letters','Evidence']),
  ('en', 'common-resume-mistakes', 'Five resume mistakes to catch before you apply',
   'A practical final review for names, dates, claims, layout and the file you attach.',
   $article$Review your CV in two passes. First check the claims against your own records. Then open the exported file and check what the reader will actually see.

## Five checks worth making

- Check the contact details. Send yourself a test email if the address is new, and open portfolio links in a private browser window.
- Line up employers and dates. Use the same month and year format and make sure each date range is attached to the right role.
- Verify significant claims. Keep numbers, job titles and credentials you can explain and support.
- Read the text in order. Copy the PDF into a text editor, then check headers, job bullets and any letters with accents.
- Check the final attachment. Compare the job posting’s file requirements with the filename and format you selected.

## Run the check again after each edit

Tailoring one section can move text to a new page or leave an outdated company name in a summary. Open the final file after exporting. If the application fills fields automatically from your resume, check those fields against the CV before submitting. Keep a copy of the version you actually sent.$article$,
   'Jobvion', 'Resume writing', array['Checklist','Editing'])
  on conflict (locale, slug) do nothing
  returning *
)
insert into public.blog_revisions (post_id, revision, snapshot)
select id, revision, to_jsonb(added) from added;
