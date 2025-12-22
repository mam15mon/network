import { Link } from "react-router-dom";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function NotFoundPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>页面不存在</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <div className="text-sm text-muted-foreground">你访问的路径不存在，返回库存页继续。</div>
        <Link to="/inventory" className={buttonVariants()}>
          返回库存
        </Link>
      </CardContent>
    </Card>
  );
}
