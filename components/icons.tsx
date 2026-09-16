/**
 * סט אייקונים פנימי.
 * מצוירים ביד ולא נטענים מספרייה חיצונית — כדי לשמור על משקל קטן,
 * על עובי קו אחיד ועל שליטה מלאה ב-currentColor.
 */

type IconProps = React.SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

/** הנקה — טיפה עם עלה */
export const IconBreast = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.5c3.2 3.4 5 6 5 8.6a5 5 0 1 1-10 0c0-2.6 1.8-5.2 5-8.6Z" />
    <path d="M12 16.5a2.6 2.6 0 0 1-2.4-2" />
  </Icon>
);

/** בקבוק */
export const IconBottle = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 2.75h4" />
    <path d="M10.5 5.25h3l.6 2.1a4 4 0 0 1 .15 1.1v10.3a2 2 0 0 1-2 2h-1.5a2 2 0 0 1-2-2V8.45a4 4 0 0 1 .15-1.1Z" />
    <path d="M9.75 11.5h4.5M9.75 14.75h4.5" />
  </Icon>
);

/** חיתול */
export const IconDiaper = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.5 6.5h17v3a10 10 0 0 1-4.6 8.4L12 20.5l-3.9-2.6A10 10 0 0 1 3.5 9.5Z" />
    <path d="M3.5 10.5c3 1.2 5.6 1.2 8.5 1.2s5.5 0 8.5-1.2" />
  </Icon>
);

/** שינה — ירח */
export const IconSleep = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.5 8.5 0 1 0 10.2 10.2Z" />
  </Icon>
);

/** מוצקים — כף */
export const IconSolids = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 13.5c2.2 0 4-2 4-4.5s-1.8-4.5-4-4.5-4 2-4 4.5 1.8 4.5 4 4.5Z" />
    <path d="M12 13.5V21" />
  </Icon>
);

/** שאיבה */
export const IconPump = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 3.5h8l-1.2 4.2a5 5 0 0 0 .3 3.6l.6 1.2a4 4 0 0 1 .4 1.8V19a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-4.7a4 4 0 0 1 .4-1.8l.6-1.2a5 5 0 0 0 .3-3.6Z" />
  </Icon>
);

/** חום */
export const IconTemp = (p: IconProps) => (
  <Icon {...p}>
    <path d="M13.5 13.6V5a1.5 1.5 0 0 0-3 0v8.6a3.5 3.5 0 1 0 3 0Z" />
    <path d="M12 16.5v-4" />
  </Icon>
);

/** תרופה */
export const IconMedicine = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="8.5" width="17" height="7" rx="3.5" />
    <path d="M12 8.5v7" />
  </Icon>
);

/** גדילה — גרף עולה */
export const IconGrowth = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 19.5V4.5" />
    <path d="M4 19.5h16" />
    <path d="M7.5 15.5 11 11l3 2.6 4-5.6" />
  </Icon>
);

/** פעילות */
export const IconActivity = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="5.5" r="2" />
    <path d="M12 7.5v5m0 0-3 6m3-6 3 6M7 10l5-1.5 5 1.5" />
  </Icon>
);

/** הערה */
export const IconNote = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 4.5h14v15l-3.5-2.5L12 19.5 8.5 17 5 19.5Z" />
    <path d="M8.5 9h7M8.5 12.5h4.5" />
  </Icon>
);

/** שעון */
export const IconClock = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 1.8" />
  </Icon>
);

export const IconPlus = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5.5v13M5.5 12h13" />
  </Icon>
);

export const IconStop = (p: IconProps) => (
  <Icon {...p}>
    <rect x="6.5" y="6.5" width="11" height="11" rx="2.5" />
  </Icon>
);

export const IconChart = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 19.5V11M12 19.5V5M19 19.5v-5.5" />
  </Icon>
);

export const IconList = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 6.5h11M9 12h11M9 17.5h11" />
    <circle cx="5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="5" cy="17.5" r="1" fill="currentColor" stroke="none" />
  </Icon>
);

export const IconSettings = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3.5v2M12 18.5v2M20.5 12h-2M5.5 12h-2M18 6l-1.4 1.4M7.4 16.6 6 18M18 18l-1.4-1.4M7.4 7.4 6 6" />
  </Icon>
);

export const IconHome = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19Z" />
  </Icon>
);
