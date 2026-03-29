
import { ResearchProject, Paper } from '../types';

// Simple heuristic to format "First Last" or "First M. Last" to "Last, First"
const formatAuthorName = (name: string): string => {
    const parts = name.trim().split(' ');
    if (parts.length > 1) {
        const lastName = parts.pop();
        return `${lastName}, ${parts.join(' ')}`;
    }
    return name;
};

export const exportProjectToBibtex = (project: ResearchProject, allPapers: Paper[]) => {
    const literaturePapers = project.literature
        .map(lit => allPapers.find(p => p.id === lit.paperId))
        .filter((p): p is Paper => Boolean(p));

    if (literaturePapers.length === 0) {
        alert("No papers in this project's literature review to export.");
        return;
    }

    const bibtexEntries = literaturePapers.map(paper => {
        const year = paper.published ? new Date(paper.published).getFullYear() : 'YEAR_UNKNOWN';
        const authors = paper.authors.map(formatAuthorName).join(' and ');
        
        // Sanitize characters for BibTeX
        const title = paper.title.replace(/([{}])/g, '\\$1');

        return `@article{${paper.arxivId},
  author  = {${authors}},
  title   = {${title}},
  journal = {arXiv preprint arXiv:${paper.arxivId}},
  year    = {${year}}
}`;
    }).join('\n\n');

    const blob = new Blob([bibtexEntries], { type: 'application/x-bibtex' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const projectSlug = project.title.toLowerCase().replace(/\s+/g, '-').slice(0, 20);
    a.href = url;
    a.download = `${projectSlug}-bibliography.bib`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};
