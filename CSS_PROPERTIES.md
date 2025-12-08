# CSS Properties Reference

This document lists all CSS custom properties (variables) defined in the project and where they are used.

## Location

All CSS variables are defined in: `src/index.css`

---

## Purple Color Variables

```css
--color-purple-600: #9333ea;  /* Main purple color for buttons */
--color-purple-700: #7e22ce;  /* Purple hover state */
--color-purple-500: #a855f7;  /* Purple for dark mode */
```

### Usage

These variables are used in the button component's purple variant:

```tsx
<Button variant="purple">Create Project</Button>
```

Or with custom classes:

```tsx
<Button className="bg-[var(--color-purple-600)] hover:bg-[var(--color-purple-700)] text-white">
  My Button
</Button>
```

---

## Sidebar CSS Properties

### Light Mode (Default)

```css
--sidebar: oklch(0.985 0 0);                    /* Sidebar background color */
--sidebar-foreground: oklch(0.145 0 0);         /* Sidebar text color */
--sidebar-primary: oklch(0.205 0 0);            /* Sidebar primary elements */
--sidebar-primary-foreground: oklch(0.985 0 0);  /* Sidebar primary text */
--sidebar-accent: oklch(0.97 0 0);              /* Sidebar accent/hover background */
--sidebar-accent-foreground: oklch(0.205 0 0);  /* Sidebar accent text */
--sidebar-border: oklch(0.922 0 0);             /* Sidebar border color */
--sidebar-ring: oklch(0.708 0 0);               /* Sidebar focus ring */
```

### Dark Mode

```css
--sidebar: oklch(0.205 0 0);                    /* Dark sidebar background */
--sidebar-foreground: oklch(0.985 0 0);         /* Dark sidebar text */
--sidebar-primary: oklch(0.488 0.243 264.376);  /* Dark sidebar primary */
--sidebar-primary-foreground: oklch(0.985 0 0); /* Dark sidebar primary text */
--sidebar-accent: oklch(0.269 0 0);             /* Dark sidebar accent */
--sidebar-accent-foreground: oklch(0.985 0 0);  /* Dark sidebar accent text */
--sidebar-border: oklch(1 0 0 / 10%);           /* Dark sidebar border */
--sidebar-ring: oklch(0.556 0 0);               /* Dark sidebar ring */
```

### Tailwind Classes (Used in Components)

These CSS variables are accessed via Tailwind classes:

- `bg-sidebar` → uses `--sidebar`
- `text-sidebar-foreground` → uses `--sidebar-foreground`
- `bg-sidebar-accent` → uses `--sidebar-accent`
- `text-sidebar-accent-foreground` → uses `--sidebar-accent-foreground`
- `border-sidebar-border` → uses `--sidebar-border`
- `ring-sidebar-ring` → uses `--sidebar-ring`

---

## Where Sidebar Properties Are Used

### 1. Sidebar Component (`src/components/ui/sidebar.tsx`)

**Line 171**: Main sidebar background

```tsx
className="bg-sidebar text-sidebar-foreground flex h-full w-(--sidebar-width) flex-col"
```

**Line 188**: Mobile sidebar

```tsx
className="bg-sidebar text-sidebar-foreground w-(--sidebar-width) p-0 [&>button]:hidden"
```

**Line 245**: Sidebar inner container

```tsx
className="bg-sidebar group-data-[variant=floating]:border-sidebar-border flex h-full w-full flex-col..."
```

**Line 363**: Sidebar separator

```tsx
className="bg-sidebar-border mx-2 w-auto"
```

**Line 406**: Sidebar group label

```tsx
className="text-sidebar-foreground/70 ring-sidebar-ring flex h-8..."
```

**Line 427**: Sidebar group action

```tsx
className="text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground..."
```

**Line 475**: Sidebar menu button (hover states)

```tsx
className="...hover:bg-sidebar-accent hover:text-sidebar-accent-foreground..."
```

**Line 562**: Sidebar menu action

```tsx
className="text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground..."
```

**Line 644**: Sidebar menu sub

```tsx
className="border-sidebar-border mx-3.5 flex..."
```

### 2. Layout Component (`src/components/utils/Layout.tsx`)

**Line 28**: Sidebar accent foreground text

```tsx
<p className="text-[0.7rem] text-sidebar-accent-foreground">by BergAi</p>
```

---

## Other CSS Properties

### Primary Colors

```css
--primary-color: #744DCD;        /* Main primary color */
--primary-hover: #5a3da0;        /* Primary hover state */
--primary-active: #4a2d8a;       /* Primary active state */
--primary: oklch(0.205 0 0);     /* Primary (shadcn) */
--primary-foreground: oklch(0.985 0 0); /* Primary text */
```

### Secondary Colors

```css
--secondary-color: #6c757d;
--secondary-light: #f8f9fa;
--secondary-lighter: #e9ecef;
--secondary: oklch(0.97 0 0);
--secondary-foreground: oklch(0.205 0 0);
```

### Background & Foreground

```css
--background: oklch(1 0 0);              /* Page background */
--foreground: oklch(0.145 0 0);          /* Text color */
--card: oklch(1 0 0);                    /* Card background */
--card-foreground: oklch(0.145 0 0);      /* Card text */
```

### Muted & Accent

```css
--muted: oklch(0.97 0 0);
--muted-foreground: oklch(0.556 0 0);
--accent: oklch(0.97 0 0);
--accent-foreground: oklch(0.205 0 0);
```

### Borders & Inputs

```css
--border: oklch(0.922 0 0);
--border-color: #dee2e6;
--input: oklch(0.922 0 0);
--ring: oklch(0.708 0 0);
```

### Destructive (Error/Delete)

```css
--destructive: oklch(0.577 0.245 27.325);
```

### Spacing

```css
--spacing-xs: 0.5rem;
--spacing-sm: 1rem;
--spacing-md: 1.5rem;
--spacing-lg: 2rem;
--spacing-xl: 3rem;
```

### Border Radius

```css
--border-radius-sm: 8px;
--border-radius-md: 12px;
--border-radius-lg: 16px;
--radius: 0.625rem;
```

### Typography

```css
--font-size-sm: 14px;
--font-size-base: 16px;
--font-size-lg: 18px;
--font-size-xl: 20px;
--font-size-2xl: 24px;
--font-size-3xl: 30px;
--font-size-4xl: 36px;

--font-weight-normal: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;
```

### Shadows

```css
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
```

### Transitions

```css
--transition-fast: 0.15s ease-in-out;
--transition-normal: 0.2s ease-in-out;
--transition-slow: 0.3s ease-in-out;
```

### Chart Colors

```css
--chart-1: oklch(0.646 0.222 41.116);
--chart-2: oklch(0.6 0.118 184.704);
--chart-3: oklch(0.398 0.07 227.392);
--chart-4: oklch(0.828 0.189 84.429);
--chart-5: oklch(0.769 0.188 70.08);
```

---

## How to Use These Properties

### In CSS Files

```css
.my-component {
  background-color: var(--sidebar);
  color: var(--sidebar-foreground);
  border: 1px solid var(--sidebar-border);
}
```

### In Tailwind Classes (Recommended)

```tsx
<div className="bg-sidebar text-sidebar-foreground border-sidebar-border">
  Content
</div>
```

### In Inline Styles

```tsx
<div style={{ backgroundColor: 'var(--sidebar)' }}>
  Content
</div>
```

### Using Purple Color Variables

```tsx
// Using the button variant
<Button variant="purple">Create Project</Button>

// Using Tailwind arbitrary values
<Button className="bg-[var(--color-purple-600)] hover:bg-[var(--color-purple-700)] text-white">
  Custom Button
</Button>

// Using inline styles
<button style={{ backgroundColor: 'var(--color-purple-600)' }}>
  Inline Style Button
</button>
```

---

## Notes

1. **Color Format**: Most colors use `oklch()` format for better color consistency

2. **Dark Mode**: All properties have dark mode variants under `.dark` class

3. **Tailwind Integration**: Properties are mapped to Tailwind classes via `@theme inline` in `index.css`

4. **Sidebar Width**: Sidebar width is controlled by JavaScript constants, not CSS variables:
   - `SIDEBAR_WIDTH = "16rem"`
   - `SIDEBAR_WIDTH_MOBILE = "18rem"`
   - `SIDEBAR_WIDTH_ICON = "3rem"`

5. **Purple Variables**: The purple color variables (`--color-purple-600`, `--color-purple-700`, `--color-purple-500`) are defined in `src/index.css` and can be customized there to change the purple theme across the application.




