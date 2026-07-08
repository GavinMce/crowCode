import { useEffect, useState, type FormEvent } from 'react';
import type { NewProjectForm, ProjectRow } from '../types.js';

interface SidebarProps {
  projects: ProjectRow[];
  selectedProjectId: string | null;
  onSelectProject: (id: string) => void;
  onCreateProject: (form: NewProjectForm) => Promise<boolean>;
}

const emptyForm: NewProjectForm = { name: '', repoUrl: '', gitCredential: '' };

export function Sidebar({ projects, selectedProjectId, onSelectProject, onCreateProject }: SidebarProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewProjectForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  // Once projects load, default to the list view unless the user has
  // already started filling out the form. Projects arrive asynchronously
  // (config fetch -> GET /projects), so this can't be an initial-state check.
  useEffect(() => {
    if (projects.length === 0) {
      setShowForm(true);
    } else {
      setShowForm((prev) => (form.name || form.repoUrl || form.gitCredential ? prev : false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects.length]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim() || !form.repoUrl.trim() || !form.gitCredential.trim() || submitting) return;
    setSubmitting(true);
    const ok = await onCreateProject(form);
    setSubmitting(false);
    if (ok) {
      setForm(emptyForm);
      setShowForm(false);
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">crowCode</span>
      </div>

      <div className="sidebar-new-project">
        {showForm ? (
          <form className="new-project-form" onSubmit={handleSubmit}>
            <input
              className="sidebar-input"
              placeholder="Project name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoFocus
            />
            <input
              className="sidebar-input"
              placeholder="Repository URL"
              value={form.repoUrl}
              onChange={(e) => setForm({ ...form, repoUrl: e.target.value })}
            />
            <input
              className="sidebar-input"
              placeholder="Git PAT"
              type="password"
              value={form.gitCredential}
              onChange={(e) => setForm({ ...form, gitCredential: e.target.value })}
            />
            <div className="new-project-form-actions">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? 'Creating…' : 'Create'}
              </button>
            </div>
          </form>
        ) : (
          <button type="button" className="btn-new-project" onClick={() => setShowForm(true)}>
            + New project
          </button>
        )}
      </div>

      <div className="sidebar-projects scrollable">
        {projects.length === 0 ? (
          <div className="sidebar-empty">No projects yet</div>
        ) : (
          projects.map((project) => (
            <button
              key={project.id}
              type="button"
              className={`sidebar-project${project.id === selectedProjectId ? ' sidebar-project--active' : ''}`}
              onClick={() => onSelectProject(project.id)}
            >
              {project.name}
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
