// Every piece of editable public text, label and theme colour is described here.
// The dashboard builds its forms from this list, the server validates against it,
// and the default values are written to the database on first start.
//
// Field types: text (one line), textarea (paragraphs), email, url, color, boolean.
// To add a new editable text: add a field here, then use {{its.key}} in a view file.

function text(key, label, defaultValue, options = {}) {
  return { key, label, type: 'text', default: defaultValue, max: 200, ...options };
}
function textarea(key, label, defaultValue, options = {}) {
  return { key, label, type: 'textarea', default: defaultValue, max: 4000, ...options };
}
function url(key, label, defaultValue, options = {}) {
  return { key, label, type: 'url', default: defaultValue, ...options };
}
function color(key, label, defaultValue, options = {}) {
  return { key, label, type: 'color', default: defaultValue, ...options };
}
function boolean(key, label, defaultValue, options = {}) {
  return { key, label, type: 'boolean', default: defaultValue ? 'yes' : 'no', ...options };
}

export const settingsSections = [
  {
    id: 'site',
    title: 'Site settings',
    description: 'Site name, navigation, footer, search descriptions, theme colours and shared labels.',
    groups: [
      {
        title: 'Identity',
        fields: [
          text('site.title', 'Site title', 'Saleh Abujazar', { max: 80, help: 'Shown in browser tabs and search results.' }),
          text('site.brand', 'Name in the header', 'Saleh Abujazar', { max: 60 }),
        ],
      },
      {
        title: 'Navigation',
        fields: [
          text('nav.home', 'Home link', 'Home', { max: 30 }),
          text('nav.cv', 'CV link', 'CV', { max: 30 }),
          text('nav.research', 'Research link', 'Research', { max: 30 }),
          text('nav.projects', 'Projects link', 'Projects', { max: 30 }),
          text('nav.contact', 'Contact link', 'Contact', { max: 30 }),
          text('nav.menu_button', 'Mobile menu button', 'Menu', { max: 30 }),
          text('nav.skip_link', 'Skip link (for keyboard users)', 'Skip to main content', { max: 60 }),
        ],
      },
      {
        title: 'Footer',
        fields: [
          text('footer.copyright', 'Copyright name', 'Saleh Abujazar', { max: 80, help: 'Shown after "© year".' }),
          text('footer.note', 'Footer note', 'Computer Engineering · Politics · Human Rights', { max: 160 }),
        ],
      },
      {
        title: 'Search engine and sharing descriptions',
        description: 'Short summaries (ideally under 160 characters) used by search engines and link previews.',
        fields: [
          text('meta.home_description', 'Home page', 'Saleh Abujazar — Computer Engineering student at OsloMet with interests in software development, politics and human rights.', { max: 300 }),
          text('meta.cv_description', 'CV page', 'The CV of Saleh Abujazar, available to read online or download as a PDF.', { max: 300 }),
          text('meta.research_description', 'Research page', 'Essays, policy briefs and research by Saleh Abujazar on technology, politics and human rights.', { max: 300 }),
          text('meta.projects_description', 'Projects page', 'Software projects and websites built by Saleh Abujazar.', { max: 300 }),
          text('meta.contact_description', 'Contact page', 'How to get in touch with Saleh Abujazar.', { max: 300 }),
        ],
      },
      {
        title: 'Theme colours',
        description: 'A small palette applied across the public site. The dashboard checks text contrast as you change them.',
        isTheme: true,
        fields: [
          color('theme.background', 'Page background', '#faf6ee', { help: 'Warm ivory by default.' }),
          color('theme.surface', 'Surface (cards and bands)', '#f1e8d8', { help: 'Restrained sand by default.' }),
          color('theme.text', 'Body text', '#2b2a26', { help: 'Charcoal by default.' }),
          color('theme.heading', 'Headings', '#3f4a2e', { help: 'Deep olive by default.' }),
          color('theme.accent', 'Accent (links and buttons)', '#a3502f', { help: 'Muted terracotta by default. Button text is white, so keep it dark enough.' }),
        ],
      },
      {
        title: 'Shared labels',
        fields: [
          text('labels.new_tab', 'Screen-reader note for links opening in a new tab', '(opens in a new tab)', { max: 60 }),
          text('labels.javascript_needed', 'Message when JavaScript is disabled', 'Enable JavaScript to load project, research and CV lists.', { max: 200 }),
          text('labels.loading', 'Loading message', 'Loading…', { max: 60 }),
          text('labels.load_error', 'Loading error message', 'This content could not be loaded. Please refresh the page to try again.', { max: 200 }),
          text('labels.preview_banner', 'Preview banner (only you see this)', 'Preview mode: draft entries are visible because you are signed in.', { max: 200 }),
          text('labels.draft_badge', 'Draft badge (preview only)', 'Draft', { max: 30 }),
        ],
      },
      {
        title: 'Page not found',
        fields: [
          text('notfound.heading', 'Heading', 'This page could not be found'),
          textarea('notfound.text', 'Text', 'The page may have moved, or the link may contain a typo.', { max: 500 }),
          text('notfound.button', 'Button label', 'Back to the home page', { max: 60 }),
        ],
      },
    ],
  },

  {
    id: 'home',
    title: 'Home page',
    description: 'Introduction, about text, areas of interest and the contact invitation. Featured entries are chosen in Projects and Research.',
    groups: [
      {
        title: 'Introduction',
        fields: [
          text('home.hero_eyebrow', 'Small line above your name', 'Computer Engineering · Politics · Human Rights', { max: 120 }),
          text('home.hero_name', 'Name', 'Saleh Abujazar', { max: 80 }),
          text('home.hero_subtitle', 'Professional subtitle', 'Palestinian-Norwegian political activist and Computer Engineering student at OsloMet', { max: 200 }),
          textarea('home.hero_intro', 'Introduction', 'I’m Saleh, a Computer Engineering student at OsloMet with an interest in software development, politics, and human rights. I’m exploring how technology shapes society—and how I can contribute through building, research, and public engagement.', { max: 800 }),
          text('home.button_projects', 'Projects button', 'Explore projects', { max: 40 }),
          text('home.button_cv', 'CV button', 'View CV', { max: 40 }),
          text('home.portrait_alt', 'Portrait description (alt text)', 'Portrait of Saleh Abujazar', { max: 200, help: 'Describes the portrait for people using screen readers.' }),
          text('home.portrait_monogram', 'Initials shown when there is no portrait', 'SA', { max: 3 }),
        ],
      },
      {
        title: 'About',
        fields: [
          text('home.about_heading', 'Heading', 'About'),
          textarea('home.about_text', 'Text', 'I’m a Palestinian-Norwegian political activist and a bachelor’s student in Computer Engineering at OsloMet. I care about how software is designed, who it serves, and what it means for people’s rights and everyday lives.\n\nThis site brings together the things I build, the questions I research and the causes I engage with. It is a work in progress, and it will grow as I do.', { help: 'Leave an empty line between paragraphs.' }),
        ],
      },
      {
        title: 'Areas of interest',
        fields: [
          text('home.interests_heading', 'Heading', 'Areas of interest'),
          text('home.interest1_title', 'First area — title', 'Software Development', { max: 80 }),
          textarea('home.interest1_text', 'First area — text', 'Building reliable, accessible software, from small tools to full web applications, and learning the engineering practices behind it.', { max: 500 }),
          text('home.interest2_title', 'Second area — title', 'Politics & Human Rights', { max: 80 }),
          textarea('home.interest2_text', 'Second area — text', 'Engaging in political debate and activism, with a focus on human rights, justice and democratic participation.', { max: 500 }),
          text('home.interest3_title', 'Third area — title', 'Technology & Society', { max: 80 }),
          textarea('home.interest3_text', 'Third area — text', 'Exploring how digital systems shape power, privacy and public life, and how technology can be held accountable.', { max: 500 }),
        ],
      },
      {
        title: 'Featured sections',
        description: 'Mark entries as “Featured” in Projects and Research to show them here. Empty sections are hidden automatically.',
        fields: [
          text('home.featured_projects_heading', 'Featured projects heading', 'Featured projects'),
          text('home.featured_projects_link', 'Link to all projects', 'All projects', { max: 40 }),
          text('home.featured_research_heading', 'Featured research heading', 'Featured research'),
          text('home.featured_research_link', 'Link to all research', 'All research', { max: 40 }),
        ],
      },
      {
        title: 'Contact invitation',
        fields: [
          text('home.contact_heading', 'Heading', 'Let’s start a conversation'),
          textarea('home.contact_text', 'Text', 'Whether you work with software, policy or research, I’d be glad to hear from you.', { max: 500 }),
          text('home.contact_button', 'Button label', 'Get in touch', { max: 40 }),
        ],
      },
    ],
  },

  {
    id: 'cv',
    title: 'CV page',
    description: 'Text around the CV PDF and the optional structured overview.',
    groups: [
      {
        title: 'Page text',
        fields: [
          text('cv.heading', 'Page heading', 'Curriculum Vitae'),
          textarea('cv.intro', 'Introduction', 'My complete CV is available below as a PDF. Read it here, open it in a new tab, or download a copy.', { max: 800 }),
          text('cv.open_button', 'Open button', 'Open CV', { max: 40 }),
          text('cv.download_button', 'Download button', 'Download CV', { max: 40 }),
          boolean('cv.show_updated', 'Show the “last updated” date', true, { help: 'The date comes from when the PDF was uploaded.' }),
          text('cv.updated_label', '“Last updated” label', 'Last updated', { max: 40 }),
          text('cv.viewer_title', 'PDF viewer name (for screen readers)', 'CV document', { max: 80 }),
        ],
      },
      {
        title: 'Empty state and mobile fallback',
        fields: [
          text('cv.empty_heading', 'Heading when no PDF is uploaded', 'The CV is on its way'),
          textarea('cv.empty_text', 'Text when no PDF is uploaded', 'A downloadable CV will be published here soon. In the meantime, feel free to get in touch.', { max: 500 }),
          text('cv.fallback_heading', 'Heading when the PDF cannot be shown inline', 'Read the CV in your PDF viewer'),
          textarea('cv.fallback_text', 'Text when the PDF cannot be shown inline', 'This device cannot display the PDF inside the page. Use “Open CV” to read it full-screen or “Download CV” to save a copy.', { max: 500 }),
        ],
      },
      {
        title: 'Structured overview',
        fields: [
          boolean('cv.show_structured', 'Show the structured overview below the PDF', true),
          text('cv.structured_heading', 'Heading', 'At a glance'),
          textarea('cv.structured_intro', 'Introduction', 'A short overview. The PDF above is the complete version.', { max: 500 }),
          text('cv.education_heading', 'Education heading', 'Education', { max: 60 }),
          text('cv.experience_heading', 'Experience heading', 'Experience', { max: 60 }),
          text('cv.volunteering_heading', 'Volunteering heading', 'Volunteering & activism', { max: 60 }),
          text('cv.skills_heading', 'Skills heading', 'Skills', { max: 60 }),
          text('cv.languages_heading', 'Languages heading', 'Languages', { max: 60 }),
        ],
      },
    ],
  },

  {
    id: 'projects',
    title: 'Projects page',
    description: 'Text on the Projects page and labels used on project cards.',
    groups: [
      {
        title: 'Page text',
        fields: [
          text('projects.heading', 'Page heading', 'Projects'),
          textarea('projects.intro', 'Introduction', 'Software, websites and other things I have built. Entries marked “sample” are placeholders that demonstrate the layout.', { max: 800 }),
          text('projects.empty_text', 'Message when there are no projects', 'No projects have been published yet. Please check back soon.', { max: 200 }),
        ],
      },
      {
        title: 'Labels',
        fields: [
          text('projects.filter_label', 'Tag filter label', 'Filter by tag', { max: 40 }),
          text('projects.filter_all', '“All” filter button', 'All', { max: 30 }),
          text('projects.type_github', 'GitHub project label', 'GitHub repository', { max: 40 }),
          text('projects.type_website', 'Website project label', 'Website', { max: 40 }),
          text('projects.type_other', 'Other project label', 'Project', { max: 40 }),
        ],
      },
    ],
  },

  {
    id: 'research',
    title: 'Research page',
    description: 'Text on the Research page, the research detail pages and research cards.',
    groups: [
      {
        title: 'Page text',
        fields: [
          text('research.heading', 'Page heading', 'Research'),
          textarea('research.intro', 'Introduction to your research interests', 'I am interested in how digital technology affects political participation, privacy and human rights, and in how public policy can respond. The entries below marked “sample” are demonstration documents, not published work.', { max: 1200 }),
          text('research.empty_text', 'Message when there is no research', 'No research has been published yet. Please check back soon.', { max: 200 }),
        ],
      },
      {
        title: 'Labels',
        fields: [
          text('research.filter_label', 'Tag filter label', 'Filter by topic', { max: 40 }),
          text('research.filter_all', '“All” filter button', 'All', { max: 30 }),
          text('research.read_label', 'Card link for uploaded documents', 'Read', { max: 40 }),
          text('research.external_label', 'Card link for external publications', 'Visit publication', { max: 40 }),
          text('research.authors_label', 'Authors label', 'Authors', { max: 40 }),
          text('research.date_label', 'Date label', 'Date', { max: 40 }),
          text('research.type_label', 'Document type label', 'Type', { max: 40 }),
          text('research.topics_label', 'Topics label', 'Topics', { max: 40 }),
        ],
      },
      {
        title: 'Detail page',
        fields: [
          text('research.back_link', 'Back link', 'All research', { max: 40 }),
          text('research.open_button', 'Open PDF button', 'Open PDF', { max: 40 }),
          text('research.download_button', 'Download PDF button', 'Download PDF', { max: 40 }),
          text('research.external_button', 'External publication button', 'Read the publication', { max: 40 }),
          text('research.viewer_title', 'PDF viewer name (for screen readers)', 'Research document', { max: 80 }),
          textarea('research.fallback_text', 'Text when the PDF cannot be shown inline', 'This device cannot display the PDF inside the page. Use the buttons above to open or download it.', { max: 500 }),
        ],
      },
    ],
  },

  {
    id: 'contact',
    title: 'Contact & social links',
    description: 'Contact details are hidden automatically when left empty.',
    groups: [
      {
        title: 'Page text',
        fields: [
          text('contact.heading', 'Page heading', 'Contact'),
          textarea('contact.intro', 'Invitation', 'I’m happy to talk about software, politics, human rights or research collaborations. Email is the best way to reach me.', { max: 800 }),
          text('contact.email_label', 'Email label', 'Email', { max: 40 }),
          text('contact.email_button', 'Email button', 'Send an email', { max: 40 }),
          text('contact.location_label', 'Location label', 'Based in', { max: 40 }),
          text('contact.linkedin_label', 'LinkedIn link label', 'LinkedIn', { max: 40 }),
          text('contact.github_label', 'GitHub link label', 'GitHub', { max: 40 }),
          text('contact.bluesky_label', 'Bluesky link label', 'Bluesky', { max: 40 }),
          text('contact.x_label', 'X link label', 'X', { max: 40 }),
          text('contact.instagram_label', 'Instagram link label', 'Instagram', { max: 40 }),
          text('contact.website_label', 'Other website link label', 'Website', { max: 40 }),
          text('contact.social_heading', 'Social links heading', 'Elsewhere online', { max: 60 }),
        ],
      },
      {
        title: 'Contact details',
        fields: [
          { key: 'contact.email', label: 'Public email address', type: 'email', default: '', help: 'Enter the address you want to publish, or leave empty to hide email.' },
          text('contact.location', 'Location (optional)', 'Oslo, Norway', { max: 100 }),
        ],
      },
      {
        title: 'Social links',
        description: 'Full addresses starting with https://. Leave a field empty to hide it. Links start empty so no fictitious profiles are published.',
        fields: [
          url('contact.linkedin', 'LinkedIn', ''),
          url('contact.github', 'GitHub', ''),
          url('contact.bluesky', 'Bluesky', ''),
          url('contact.x', 'X (Twitter)', ''),
          url('contact.instagram', 'Instagram', ''),
          url('contact.website', 'Other website', ''),
        ],
      },
    ],
  },
];

/** Flat list of every editable field, for validation and default seeding. */
export const allSettingFields = settingsSections.flatMap((section) =>
  section.groups.flatMap((group) => group.fields),
);

export const fieldsByKey = new Map(allSettingFields.map((field) => [field.key, field]));

/**
 * Files that belong to the whole site rather than to one entry.
 * The setting stores the media id; uploads happen through dedicated endpoints.
 */
export const mediaSlots = {
  portrait: { settingKey: 'media.portrait', label: 'Portrait', allowedKinds: ['image'] },
  cv: { settingKey: 'media.cv', label: 'CV', allowedKinds: ['pdf'] },
  favicon: { settingKey: 'media.favicon', label: 'Favicon', allowedKinds: ['image', 'icon'] },
};
