import type { FC } from 'hono/jsx';

export const ClientHead: FC = () => {
  if (import.meta.env.PROD) {
    return <link rel="stylesheet" href="/main.css" />;
  }
  return <link rel="stylesheet" href="/src/client/styles/main.css" />;
};
