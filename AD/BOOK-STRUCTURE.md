# Technical & UI Specification: Book Structure

## 1. Page Model & Scope

- **Total Page Count:** Exactly **12 pages** (strictly 1 physical page per structural item).
- **Page Layout Mode:** Pure text/media layout across all pages for now (no embedded mini-games or canvas activities).
- **Navigation Flow:** Strictly linear sequence from Page 1 to Page 12.
- **Top-Right Page Numbering:** Displays formatted counter (`01 / 12` to `12 / 12`), omitting on Page 1 (Cover).

---

## 2. Page-by-Page Technical & UI Mapping

| Page # | Slug / ID | Title / Section | Component Layout Archetype | UI Characteristics |
|:---:|:---|:---|:---|:---|
| **01** | `page-01-cover` | Cover | `cover` | Minimalist luxury book cover, title, subtitle, author credits, no page number |
| **02** | `page-02-introduction` | Introdução Geral | `standard` | Prosa introdutória, epígrafe opcional, contextualização do livro |
| **03** | `page-03-index` | Índice | `index` | Lista estática de capítulos e páginas correspondentes em tipografia limpa |
| **04** | `page-04-chapter-1` | Cap. 1: Introdução à Adolescência | `standard` | Título, subtítulo, parágrafos de texto (o que é e o que acontece) |
| **05** | `page-05-chapter-2` | Cap. 2: Aspectos da Adolescência | `standard` | Título, subtítulo, parágrafos de texto (dimensões da adolescência) |
| **06** | `page-06-chapter-3` | Cap. 3: Estágios de Desenvolvimento | `standard` | Título, subtítulo, parágrafos de texto (estágios cognitivos/psicológicos) |
| **07** | `page-07-chapter-4` | Cap. 4: Mitos e Verdades | `standard` | Título, subtítulo, parágrafos e caixas comparativas de destaque |
| **08** | `page-08-chapter-5` | Cap. 5: Como Ajudar | `standard` | Título, subtítulo, parágrafos e orientações práticas |
| **09** | `page-09-chapter-6` | Cap. 6: Situações Práticas | `standard` | Título, subtítulo, parágrafos e estudos de caso cotidianos |
| **10** | `page-10-conclusion` | Conclusão | `standard` | Considerações finais, síntese reflexiva |
| **11** | `page-11-references` | Referências Bibliográficas | `references` | Lista estruturada de referências acadêmicas e bibliografia |
| **12** | `page-12-authors` | Sobre os Autores | `authors` | Cards de perfil dos autores (nome, minibio, credenciais) |

---

## 3. Data Architecture & File Organization

To allow quick and isolated text editing without touching application or rendering code, content will be organized into dedicated, modular TypeScript data files:

```text
src/lib/data/
├── chapters/
│   ├── page-01-cover.ts
│   ├── page-02-introduction.ts
│   ├── page-03-index.ts
│   ├── page-04-chapter-1.ts
│   ├── page-05-chapter-2.ts
│   ├── page-06-chapter-3.ts
│   ├── page-07-chapter-4.ts
│   ├── page-08-chapter-5.ts
│   ├── page-09-chapter-6.ts
│   ├── page-10-conclusion.ts
│   ├── page-11-references.ts
│   └── page-12-authors.ts
└── bookPages.ts       # Master array importing and sequencing pages 01 to 12
```

### TypeScript Data Schema

```typescript
export interface BasePageData {
  id: string;
  pageNumber: number;
  type: 'cover' | 'index' | 'standard' | 'references' | 'authors';
  chapterTitle?: string;
  title?: string;
  subtitle?: string;
  paragraphs?: string[];
  callout?: {
    title?: string;
    text: string;
    type?: 'insight' | 'experiment' | 'warning';
  };
  indexEntries?: Array<{
    title: string;
    pageNumber: number;
  }>;
  references?: Array<{
    author: string;
    year: string;
    title: string;
    source: string;
  }>;
  authors?: Array<{
    name: string;
    role: string;
    bio: string;
  }>;
}
```

---

## 4. UI Details for Specialized Pages

1. **`index` (Page 03):**
   - Clean, elegant book index list.
   - Shows chapter title aligned to the left and page number aligned to the right with dot leaders or subtle spacing.
   - Static presentation matching traditional editorial design.

2. **`references` (Page 11):**
   - Academic citation styling (ABNT / APA formatted list).
   - Generous line-height and subtle hanging indent for readability.

3. **`authors` (Page 12):**
   - Author cards displaying name, role/title, and biographical summary.
   - Clean borders and serif typography matching the `#FDFBF7` flat sheet.
