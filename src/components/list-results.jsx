import { Alert } from "./ui";
import { ListEmpty, Pagination } from "./list-controls";
import { ListLoading } from "./list-loading";

export function ListResults({ result, path, state, title, children, empty }) {
  if (result.error)
    return (
      <Alert tone="error">
        This list could not be loaded. Apply pending dashboard migrations or try again. {result.error.message}
      </Alert>
    );
  return (
    <ListLoading>
      {result.data.length ? (
        children
      ) : (
        <ListEmpty path={path} state={state} title={title}>
          {empty}
        </ListEmpty>
      )}
      <Pagination path={path} state={state} count={result.count ?? 0} />
    </ListLoading>
  );
}
