import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { showError, showSuccess, showLoading, dismissToast } from "@/utils/toast";
import { MadeWithDyad } from "@/components/made-with-dyad";
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { Session } from "@supabase/supabase-js";

interface ScrapedLink {
  href: string;
  title: string;
}

interface HistoryLink {
  link_href: string;
  link_title: string;
}

const Index = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [url, setUrl] = useState("");
  const [scrapedData, setScrapedData] = useState<ScrapedLink[]>([]);
  const [history, setHistory] = useState<HistoryLink[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchHistory = async () => {
    const { data, error } = await supabase
      .from('scraped_links')
      .select('link_href, link_title')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      showError('Error al cargar el historial.');
      console.error(error);
    } else {
      setHistory(data);
    }
  };

  useEffect(() => {
    if (session) {
      fetchHistory();
    }
  }, [session]);

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

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setScrapedData(data.data);
      showSuccess(`¡Éxito! Se encontraron y guardaron ${data.data.length} enlaces.`);
      fetchHistory(); // Refresh history
    } catch (error: any) {
      dismissToast(String(toastId));
      showError(`Error al scrapear: ${error.message}`);
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-md">
          <h2 className="text-2xl font-bold text-center">Web Scraper</h2>
          <Auth
            supabaseClient={supabase}
            appearance={{ theme: ThemeSupa }}
            providers={[]}
            theme="light"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-2xl">
        <Card className="w-full">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Web Scraper</CardTitle>
              <CardDescription>
                Los resultados se guardarán en tu cuenta.
              </CardDescription>
            </div>
            <Button variant="outline" onClick={() => supabase.auth.signOut()}>Cerrar sesión</Button>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="scraper" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="scraper">Nuevo Scrape</TabsTrigger>
                <TabsTrigger value="history">Historial</TabsTrigger>
              </TabsList>
              <TabsContent value="scraper" className="mt-4">
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
                {scrapedData.length > 0 && (
                  <div className="w-full mt-4">
                    <h3 className="font-semibold mb-2">Resultados Recientes:</h3>
                    <ScrollArea className="h-60 w-full rounded-md border p-4">
                      {scrapedData.map((item, index) => (
                        <div key={item.href + index}>
                          <div className="text-sm text-left py-2">
                            <p className="font-medium truncate" title={item.title}>{item.title}</p>
                            <a href={item.href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs truncate block">{item.href}</a>
                          </div>
                          {index < scrapedData.length - 1 && <Separator />}
                        </div>
                      ))}
                    </ScrollArea>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="history" className="mt-4">
                <h3 className="font-semibold mb-2">Últimos 100 Enlaces Guardados:</h3>
                <ScrollArea className="h-72 w-full rounded-md border p-4">
                  {history.length > 0 ? history.map((item, index) => (
                    <div key={item.link_href + index}>
                      <div className="text-sm text-left py-2">
                        <p className="font-medium truncate" title={item.link_title}>{item.link_title}</p>
                        <a href={item.link_href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs truncate block">{item.link_href}</a>
                      </div>
                      {index < history.length - 1 && <Separator />}
                    </div>
                  )) : <p className="text-sm text-gray-500">No hay historial todavía.</p>}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default Index;