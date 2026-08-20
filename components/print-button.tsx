"use client";

import { Printer } from "lucide-react";
import { Button } from "./ui";

export function PrintButton() {
  return (
    <Button variant="secondary" onClick={() => window.print()}>
      <Printer className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
      打印 / 导出PDF
    </Button>
  );
}
