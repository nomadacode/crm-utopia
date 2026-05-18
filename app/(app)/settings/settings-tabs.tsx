"use client";

import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";

/**
 * Layout-only wrapper around the settings sections. Server data is fetched
 * in the page and passed in as already-rendered elements so this component
 * is purely about tab state + visual grouping. The "Usuarios" tab is only
 * rendered when the caller passes a `usuarios` node (admin-only on the page).
 */
export function SettingsTabs({
  negocio,
  personalidad,
  derivacion,
  tags,
  usuarios,
}: {
  negocio: React.ReactNode;
  personalidad: React.ReactNode;
  derivacion: React.ReactNode;
  tags: React.ReactNode;
  usuarios?: React.ReactNode;
}) {
  return (
    <Tabs defaultValue="negocio">
      <TabsList className="self-start">
        <TabsTrigger value="negocio">Negocio</TabsTrigger>
        <TabsTrigger value="personalidad">Personalidad</TabsTrigger>
        <TabsTrigger value="derivacion">Derivación</TabsTrigger>
        <TabsTrigger value="tags">Tags</TabsTrigger>
        {usuarios && <TabsTrigger value="usuarios">Usuarios</TabsTrigger>}
      </TabsList>

      <TabsContent value="negocio">
        <Card className="rounded-lg p-6">{negocio}</Card>
      </TabsContent>

      <TabsContent value="personalidad">
        <Card className="rounded-lg p-6">{personalidad}</Card>
      </TabsContent>

      <TabsContent value="derivacion">
        <Card className="rounded-lg p-6">{derivacion}</Card>
      </TabsContent>

      <TabsContent value="tags">
        <Card className="rounded-lg p-6">{tags}</Card>
      </TabsContent>

      {usuarios && (
        <TabsContent value="usuarios">
          <Card className="rounded-lg p-6">{usuarios}</Card>
        </TabsContent>
      )}
    </Tabs>
  );
}
