import { Card, CardContent } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="container mx-auto py-20">
      <div className="max-w-2xl mx-auto text-center">
        <div className="mb-8">
          <h1 className="text-6xl font-bold text-primary mb-4">
            Zoby Boards
          </h1>
        </div>
        
        <Card className="backdrop-blur-sm bg-card/80 border-border/50">
          <CardContent className="p-8">
            <p className="text-lg text-muted-foreground leading-relaxed">
              Welcome to Zoby Boards, the place to add, vote on, and track ideas and work.
              You'll just need your unique board link and passcode to get started.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}