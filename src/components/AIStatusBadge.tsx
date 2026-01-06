import { isAIAvailable, getProviderName } from '../services/ai';

export function AIStatusBadge() {
  const aiAvailable = isAIAvailable();
  const providerName = getProviderName();

  return (
    <div
      className={`px-2 py-1 text-xs rounded-full ${
        aiAvailable
          ? 'bg-green-100 text-green-700'
          : 'bg-gray-100 text-gray-500'
      }`}
      title={aiAvailable ? `Connected to ${providerName}` : 'Using mock AI (configure API key in .env)'}
    >
      {aiAvailable ? (
        <>
          <span className="inline-block w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5 animate-pulse" />
          {providerName}
        </>
      ) : (
        <>
          <span className="inline-block w-1.5 h-1.5 bg-gray-400 rounded-full mr-1.5" />
          Mock
        </>
      )}
    </div>
  );
}
