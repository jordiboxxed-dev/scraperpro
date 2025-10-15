import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { showError, showSuccess, showLoading, dismissToast } from "@/utils/toast";
import { MadeWithDyad } from "@/components/made-with-dyad";

interface ScrapedLink {
  href: string;
  title: string;
}

const Index = () => {
  const [url, setUrl] = useState("");
  const [scrapedData, setScrapedData] = useState<ScrapedLink[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleScrape = async () => {
    if (!url) {
      showError("Por favor, introduce una URL.");
      return;
    }

    setIsLoading(true);
    setScrapedData([]);
    const toastId = showLoading("Scrapeando la página...");

    try {
      const { data, error } = await supabase.functions.invoke("scraper", {
        body: { url },
      });

      dismissToast(String(toastId));

      if (error) {
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setScrapedData(data.data);
      showSuccess(`¡Éxito! Se encontraron ${data.data.length} enlaces.`);
    } catch (error: any) {
      dismissToast(String(toastId));
      showError(`Error al scrapear: ${error.message}`);
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-2xl">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Web Scraper</CardTitle>
            <CardDescription>
              Introduce la URL de la página que quieres scrapear.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex w-full items-center space-x-2">
              <Input
                type="url"
                placeholder="https://ejemplo.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isLoading}
              />
              <Button onClick={handleScrape} disabled={isLoading}>
                {isLoading ? "Scrapeando..." : "Scrapear"}
              </Button>
            </div>
          </CardContent>
          {scrapedData.length > 0 && (
            <CardFooter>
              <div className="w-full mt-4">
                <h3 className="font-semibold mb-2">Enlaces Encontrados:</h3>
                <ScrollArea className="h-72 w-full rounded-md border p-4">
                  {scrapedData.map((item, index) => (
                    <div key={item.href + index}>
                      <div className="text-sm text-left py-2">
                        <p className="font-medium truncate" title={item.title}>{item.title}</p>
                        <a
                          href={item.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-xs truncate block"
                        >
                          {item.href}
                        </a>
                      </div>
                      {index < scrapedData.length - 1 && <Separator />}
                    </div>
                  ))}
                </ScrollArea>
              </div>
            </CardFooter>
          )}
        </Card>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default Index;