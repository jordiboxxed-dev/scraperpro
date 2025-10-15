import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { showError, showSuccess, showLoading, dismissToast } from "@/utils/toast";
import { MadeWithDyad } from "@/components/made-with-dyad";

const Index = () => {
  const [url, setUrl] = useState("");
  const [scrapedContent, setScrapedContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleScrape = async () => {
    if (!url) {
      showError("Por favor, introduce una URL.");
      return;
    }

    setIsLoading(true);
    setScrapedContent("");
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

      setScrapedContent(data.html);
      showSuccess("¡Página scrapeada con éxito!");
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
          {scrapedContent && (
            <CardFooter>
              <div className="w-full mt-4">
                <h3 className="font-semibold mb-2">Contenido Obtenido:</h3>
                <pre className="bg-gray-100 p-4 rounded-md text-xs overflow-auto h-64 w-full">
                  <code>{scrapedContent}</code>
                </pre>
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