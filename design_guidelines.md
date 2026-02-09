# Design Guidelines: Portal de Inscrições de Corrida

## Design Approach

**Reference-Based with Sports/Fitness Focus**
Drawing inspiration from modern sports platforms like Strava, Nike Run Club, and event platforms like Eventbrite, while adapting to the Brazilian market context. The design emphasizes clarity, speed of navigation, and athletic energy while maintaining professional credibility.

## Core Design Principles

1. **Mobile-First Athletic Experience**: Design for runners on-the-go, ensuring quick access to registration and event information
2. **Trust Through Clarity**: Clean forms and transparent information build confidence in the registration process
3. **Energy with Restraint**: Use the yellow accent strategically to create energy without overwhelming the interface

## Color Implementation

**Primary Palette**
- Navy Blue (#032c6b): Primary backgrounds, headers, key CTAs, text headings
- Yellow (#e8b73d): Accent for active states, important CTAs, status indicators, highlights
- White (#FFFFFF): Content backgrounds, text on dark surfaces, breathing room

**Strategic Usage**
- Hero sections: Navy gradient overlays on running imagery
- Event cards: White backgrounds with navy borders, yellow accent on hover/active states
- CTAs: Navy primary buttons, yellow for "Register Now" and conversion actions
- Status indicators: Yellow for "Registered", navy for "Available", subtle grays for past events
- Forms: White backgrounds with navy labels, yellow focus states on inputs

## Typography System

**Fonts**: Inter (via Google Fonts CDN) for clean, athletic readability

**Hierarchy**:
- H1: text-4xl md:text-5xl font-bold (Event names, page headers)
- H2: text-2xl md:text-3xl font-semibold (Section titles, event details)
- H3: text-xl md:text-2xl font-semibold (Card headers, form sections)
- Body: text-base md:text-lg (General content)
- Small: text-sm (Labels, helper text, metadata)
- Labels: text-sm font-medium uppercase tracking-wide (Form labels, categories)

## Layout System

**Spacing Primitives**: Tailwind units of 2, 4, 6, 8, 12, 16
- Component padding: p-4 md:p-6
- Section spacing: py-12 md:py-16
- Card gaps: gap-4 md:gap-6
- Form fields: space-y-4

**Grid System**:
- Events listing: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6
- Event details: Single column with max-w-4xl
- Form layout: Single column max-w-2xl with grouped fields

**Container**: max-w-7xl mx-auto px-4 md:px-6

## Component Library

### Navigation
**Mobile-First Header**
- Sticky top navigation with hamburger menu on mobile
- Logo left, user avatar/login right
- Expandable menu overlay with links: Eventos, Minhas Inscrições, Minha Conta
- Navy background with white text, yellow underline on active page

### Event Cards
- White background with subtle shadow
- Event image top (16:9 ratio), 200px height
- Navy heading, gray metadata (date, location, distance)
- Yellow "Inscrever-se" button at bottom
- Hover: lift effect with increased shadow

### Login Form
- Centered card on navy background
- max-w-md width
- White card with padding p-8
- Fields: CPF (with mask xxx.xxx.xxx-xx), Data de Nascimento (date picker)
- Full-width navy button with white text
- Link to registration below

### Registration Form (Cadastro)
- Progressive sections to reduce cognitive load
- Required fields marked with yellow asterisk
- Field groups with visual separation (border-t pt-6)
- Input styling: border-2 border-gray-300, focus:border-yellow-500, rounded-lg, p-3
- Dropdowns for Estado, Cidade, Sexo, Escolaridade
- Full-width yellow submit button "Completar Cadastro"

### Event Detail Page
- Hero section: Image with navy gradient overlay, event title in white, date/location prominent
- Content sections: About, Route Map, Categories, Pricing, Registration
- Sticky "Register Now" button (yellow) on scroll
- Info cards for distances, start time, location with icons

### Minha Conta Page
- Profile section with editable fields
- Same form styling as registration
- Sections: Dados Pessoais, Contato, Endereço
- Navy "Salvar Alterações" button

### Minhas Inscrições Page
- Tab navigation: Próximas / Concluídas
- Event cards with registration status badge (yellow for active)
- Quick actions: View details, Download bib, Cancel (with confirmation)

## Images

**Hero Images**:
- Events page: Dynamic running scene with multiple runners, Brazilian landscape (1920x600px)
- Event detail: Specific event location or route panorama (1920x500px)
- Login/Register background: Subtle running texture or abstract athletic pattern

**Event Cards**: Each event should have representative image showing course, finish line, or participants

**Image Treatment**: Navy blue gradient overlay (opacity-60) for text readability on hero images

## Interactive States

**Buttons**:
- Default: Solid background with smooth transition
- Hover: Slight brightness increase, subtle lift (shadow)
- Active: Scale down slightly (scale-95)

**Form Inputs**:
- Default: Gray border
- Focus: Yellow border with subtle yellow shadow
- Error: Red border with error message below
- Success: Green border on validation

**Cards**:
- Hover: translateY(-4px) with shadow increase

## Responsive Breakpoints

- Mobile: < 768px (single column, simplified navigation)
- Tablet: 768px - 1024px (2 columns for events)
- Desktop: > 1024px (3 columns, full feature set)

## Form Validation & Accessibility

- Real-time CPF format validation (xxx.xxx.xxx-xx)
- Required field indicators (*) in yellow
- Clear error messages below fields in red
- ARIA labels on all form inputs
- Keyboard navigation support throughout
- Focus indicators clearly visible with yellow outline

This design creates a trustworthy, energetic registration experience that serves Brazilian runners efficiently while maintaining professional credibility through clean, modern interface design.