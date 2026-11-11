import Form from '../../../../components/common/Form';
import InputField from '../../../../components/common/InputField';
import TextArea from '../../../../components/common/TextArea';
import DatePicker from '../../../../components/common/DatePicker';
import Dropdown from '../../../../components/common/DropDown';
import Checkbox from '../../../../components/common/Checkbox';
import HtmlEditor from '../../../../components/common/HtmlEditor';
import FileUpload from '../../../../components/common/FileUpload';
import Button from '../../../../components/common/Buttons';
import theme from '../theme/theme';

const STATUS_OPTIONS = [
  { value: 'I', label: 'Draft (hidden from the storefront)' },
  { value: 'A', label: 'Published' },
];

const toDateOrNull = (value) => (value ? new Date(value) : null);

// Local YYYY-MM-DD (toISOString() would shift a local-midnight date to the previous day in UTC+ zones).
const toDateString = (date) => {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const hasText = (html) => (html || '').replace(/<[^>]*>/g, '').trim().length > 0;

const validationSchema = {
  title: {
    required: true,
    validations: [
      (v) => (v.trim().length >= 3 ? true : 'Title must be at least 3 characters'),
      (v) => (v.trim().length <= 150 ? true : 'Title must not exceed 150 characters'),
    ],
  },
  slug: {
    validations: [(v) => (!v || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v) ? true : 'Use lowercase letters, numbers and hyphens only')],
  },
  content: {
    validations: [(v) => (hasText(v) ? true : 'Write the post content')],
  },
};

/**
 * Add/Edit form for a blog post.
 *
 * @param {'add'|'edit'} props.mode
 * @param {Object} props.initialValues - the full post (with `content`) when editing
 * @param {(fields: Object, coverImage: File|null) => Promise<void>} props.onSubmit
 */
const BlogForm = ({ mode = 'add', initialValues = {}, onSubmit, onCancel, submitting = false }) => {
  const formInitialValues = {
    title: initialValues.title || '',
    slug: initialValues.slug || '',
    excerpt: initialValues.excerpt || '',
    content: initialValues.content || '',
    category: initialValues.category || '',
    tags: (initialValues.tags || []).join(', '),
    authorName: initialValues.authorName || '',
    status: initialValues.status || 'I',
    publishedAt: toDateOrNull(initialValues.publishedAt),
    isFeatured: !!initialValues.isFeatured,
    metaTitle: initialValues.metaTitle || '',
    metaDescription: initialValues.metaDescription || '',
    coverFile: null,
    removeCover: false,
  };

  const handleFormSubmit = async (values) => {
    const fields = {
      title: values.title.trim(),
      content: values.content,
      excerpt: values.excerpt.trim(),
      category: values.category.trim(),
      tags: values.tags.trim(),
      authorName: values.authorName.trim(),
      status: values.status,
      isFeatured: values.isFeatured,
      metaTitle: values.metaTitle.trim(),
      metaDescription: values.metaDescription.trim(),
    };
    // A blank slug means "build it from the title" (add) / "keep it" (edit).
    if (values.slug.trim()) fields.slug = values.slug.trim();
    if (values.publishedAt) fields.publishedAt = toDateString(values.publishedAt);
    if (values.removeCover && !values.coverFile) fields.removeCoverImage = true;

    await onSubmit(fields, values.coverFile);
  };

  return (
    <Form initialValues={formInitialValues} validationSchema={validationSchema} onSubmit={handleFormSubmit}>
      {({ values, errors, touched, submitAttempted, setFieldValue, handleChange, handleBlur }) => {
        const showError = (name) => (touched[name] || submitAttempted) && errors[name];
        const fieldError = (name) =>
          showError(name) ? <p className={`mt-1 text-sm ${theme.text.error}`} role="alert">{errors[name]}</p> : null;
        const currentCover = !values.removeCover ? initialValues.coverImage : null;

        return (
          <>
            <div>
              <InputField
                className="w-full"
                label="Title"
                name="title"
                placeholder="Enter the post title"
                value={values.title}
                onChange={handleChange('title')}
                onBlur={handleBlur('title')}
                required
                maxLength={150}
                showError={false}
              />
              {fieldError('title')}
            </div>

            <div>
              <InputField
                className="w-full"
                label="Page address (slug)"
                name="slug"
                placeholder="auto-generated from the title"
                value={values.slug}
                onChange={handleChange('slug')}
                onBlur={handleBlur('slug')}
                maxLength={180}
                showError={false}
              />
              <p className={`mt-1 text-xs ${theme.text.muted}`}>
                The post will live at /blog/{values.slug || 'your-post-title'}. Leave blank to build it from the title.
              </p>
              {fieldError('slug')}
            </div>

            <TextArea
              label="Short summary"
              name="excerpt"
              placeholder="One or two sentences shown on the blog list and in search results."
              value={values.excerpt}
              onChange={handleChange('excerpt')}
              rows={3}
              maxLength={300}
              showCharCount
              showError={false}
            />

            <div>
              <HtmlEditor
                label="Content"
                name="content"
                required
                rows={14}
                value={values.content}
                onChange={(html) => setFieldValue('content', html)}
                onBlur={handleBlur('content')}
                helperText="Use the toolbar for headings, lists and links. The Preview tab shows how the text will look."
                previewHeight="360px"
              />
              {fieldError('content')}
            </div>

            <div className="space-y-3">
              {currentCover && (
                <div>
                  <p className={`text-sm ${theme.text.muted} mb-2`}>Current cover image - upload a new file below to replace it.</p>
                  <img src={currentCover} alt="Current cover" className="h-28 rounded-lg border border-gray-200 object-cover" />
                  <button
                    type="button"
                    className="mt-2 text-sm text-red-600 hover:underline"
                    onClick={() => setFieldValue('removeCover', true)}
                  >
                    Remove cover image
                  </button>
                </div>
              )}
              <FileUpload
                label={currentCover ? 'Replace Cover Image' : 'Cover Image'}
                accept="image/*"
                maxSize={5 * 1024 * 1024}
                onFilesSelected={(files) => setFieldValue('coverFile', files[0] || null)}
                helperText="Wide images (about 1200 x 630) look best. JPG, PNG or WEBP, up to 5MB."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField
                className="w-full"
                label="Category"
                name="category"
                placeholder="e.g. Guides"
                value={values.category}
                onChange={handleChange('category')}
                maxLength={40}
              />
              <InputField
                className="w-full"
                label="Author"
                name="authorName"
                placeholder="Author name"
                value={values.authorName}
                onChange={handleChange('authorName')}
                maxLength={60}
              />
            </div>

            <div>
              <InputField
                className="w-full"
                label="Tags"
                name="tags"
                placeholder="e.g. tips, guide, news"
                value={values.tags}
                onChange={handleChange('tags')}
                maxLength={400}
              />
              <p className={`mt-1 text-xs ${theme.text.muted}`}>Separate with commas. Up to 10 tags.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Dropdown
                label="Status"
                name="status"
                options={STATUS_OPTIONS}
                value={values.status}
                onChange={(val) => setFieldValue('status', val)}
                required
              />
              <div>
                <DatePicker
                  label="Publish date"
                  name="publishedAt"
                  value={values.publishedAt}
                  onChange={(date) => setFieldValue('publishedAt', date)}
                />
                <p className={`mt-1 text-xs ${theme.text.muted}`}>
                  Leave blank to publish immediately. A future date schedules the post.
                </p>
              </div>
            </div>

            <Checkbox
              label="Feature this post"
              description="Featured posts are shown first, in the large card at the top of the blog page."
              checked={values.isFeatured}
              onChange={handleChange('isFeatured')}
            />

            <div className="border border-gray-200 rounded-lg p-3 space-y-3">
              <p className={`text-sm font-medium ${theme.text.heading}`}>Search engine preview (optional)</p>
              <InputField
                className="w-full"
                label="SEO title"
                name="metaTitle"
                placeholder="Defaults to the post title"
                value={values.metaTitle}
                onChange={handleChange('metaTitle')}
                maxLength={70}
              />
              <TextArea
                label="SEO description"
                name="metaDescription"
                placeholder="Defaults to the short summary"
                value={values.metaDescription}
                onChange={handleChange('metaDescription')}
                rows={2}
                maxLength={170}
                showCharCount
                showError={false}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant={theme.button.ghost} onClick={onCancel} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" variant={theme.button.primary} loading={submitting}>
                {mode === 'edit' ? 'Save Changes' : 'Add Post'}
              </Button>
            </div>
          </>
        );
      }}
    </Form>
  );
};

export default BlogForm;
