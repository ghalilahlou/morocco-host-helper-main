import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        /**
         * react-day-picker Dropdown : le <select> doit rester invisible (overlay plein
         * parent) ; le texte visible est le div caption_label en dessous. Ne pas appliquer
         * bordure/fond au select — seulement aux wrappers dropdown_month / dropdown_year.
         * vhidden : sr-only car le CSS officiel rdp-vhidden n'est pas importé globalement.
         */
        vhidden: "sr-only",
        caption: "flex justify-center pt-1 relative items-center min-h-9",
        caption_label:
          "relative z-[1] inline-flex items-center gap-1 whitespace-nowrap text-sm font-medium pointer-events-none",
        caption_dropdowns: "flex flex-wrap justify-center gap-2 items-center",
        dropdown:
          "absolute inset-0 z-[2] h-full w-full min-h-8 cursor-pointer opacity-0 appearance-none border-0 bg-transparent p-0 font-inherit",
        dropdown_month:
          "relative inline-flex h-8 min-w-[7.5rem] shrink-0 items-center rounded-md border border-input bg-background px-2 text-sm",
        dropdown_year:
          "relative inline-flex h-8 min-w-[5.5rem] shrink-0 items-center rounded-md border border-input bg-background px-2 text-sm",
        dropdown_icon: "ml-0.5 h-4 w-4 shrink-0 opacity-70",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell:
          "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside:
          "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ..._props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ..._props }) => <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
