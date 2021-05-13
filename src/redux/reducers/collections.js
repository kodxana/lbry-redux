// @flow
import { handleActions } from 'util/redux-utils';
import * as ACTIONS from 'constants/action_types';
import * as COLS from 'constants/collections';

const getTimestamp = () => {
  return Math.floor(Date.now() / 1000);
};

const defaultState: CollectionState = {
  builtin: {
    watchlater: {
      items: [
        'lbry://why-wolves-determine-the-shape-of-rivers#d8a60a057ac9adb6b618be6985ca8361c730c02e',
      ],
      id: COLS.WATCH_LATER_ID,
      name: 'Watch Later',
      updatedAt: getTimestamp(),
      type: COLS.COL_TYPE_PLAYLIST,
    },
    favorites: {
      items: [
        'lbry://why-wolves-determine-the-shape-of-rivers#d8a60a057ac9adb6b618be6985ca8361c730c02e',
      ],
      id: COLS.FAVORITES_ID,
      name: 'Favorites',
      type: COLS.COL_TYPE_PLAYLIST,
      updatedAt: getTimestamp(),
    },
  },
  resolved: {},
  unpublished: {}, // sync
  edited: {},
  pending: {},
  saved: [],
  isResolvingCollectionById: {},
  error: null,
};

const collectionsReducer = handleActions(
  {
    [ACTIONS.COLLECTION_NEW]: (state, action) => {
      const { entry: params } = action.data; // { id:, items: Array<string>}
      // entry
      const newListTemplate = {
        id: params.id,
        name: params.name,
        items: [],
        updatedAt: getTimestamp(),
        type: params.type,
      };

      const newList = Object.assign({}, newListTemplate, { ...params });
      const { unpublished: lists } = state;
      const newLists = Object.assign({}, lists, { [params.id]: newList });

      return {
        ...state,
        unpublished: newLists,
      };
    },

    [ACTIONS.COLLECTION_DELETE]: (state, action) => {
      const { id, collectionKey } = action.data;
      const { edited: editList, unpublished: unpublishedList, pending: pendingList } = state;
      const newEditList = Object.assign({}, editList);
      const newUnpublishedList = Object.assign({}, unpublishedList);

      const newPendingList = Object.assign({}, pendingList);

      if (collectionKey && state[collectionKey] && state[collectionKey][id]) {
        const newList = Object.assign({}, state[collectionKey]);
        delete newList[id];
        return {
          ...state,
          [collectionKey]: newList,
        };
      } else {
        if (newEditList[id]) {
          delete newEditList[id];
        } else if (newUnpublishedList[id]) {
          delete newUnpublishedList[id];
        } else if (newPendingList[id]) {
          delete newPendingList[id];
        }
      }
      return {
        ...state,
        edited: newEditList,
        unpublished: newUnpublishedList,
        pending: newPendingList,
      };
    },

    [ACTIONS.COLLECTION_PENDING]: (state, action) => {
      const { localId, claimId } = action.data;
      const { edited: editList, unpublished: unpublishedList, pending: pendingList } = state;
      const newEditList = Object.assign({}, editList);
      const newUnpublishedList = Object.assign({}, unpublishedList);
      const newPendingList = Object.assign({}, pendingList);

      const isEdit = editList[localId];
      if (localId) {
        // pending from unpublished -> published
        // delete from local
        newPendingList[claimId] = Object.assign(
          {},
          newEditList[localId] || newUnpublishedList[localId] || {}
        );
        if (isEdit) {
          delete newEditList[localId];
        } else {
          delete newUnpublishedList[localId];
        }
      } else {
        // pending from edited published -> published
        if (isEdit) {
          newPendingList[claimId] = Object.assign({}, newEditList[claimId]);
          delete newEditList[claimId];
        }
      }

      return {
        ...state,
        edited: newEditList,
        unpublished: newUnpublishedList,
        pending: newPendingList,
      };
    },

    [ACTIONS.COLLECTION_EDIT]: (state, action) => {
      const { id, collectionKey, collection } = action.data;

      if (COLS.BUILTIN_LISTS.includes(id)) {
        const { builtin: lists } = state;
        return {
          ...state,
          [collectionKey]: { ...lists, [id]: collection },
        };
      }

      if (collectionKey === 'edited') {
        const { edited: lists } = state;
        return {
          ...state,
          edited: { ...lists, [id]: collection },
        };
      }
      const { unpublished: lists } = state;
      return {
        ...state,
        unpublished: { ...lists, [id]: collection },
      };
    },

    [ACTIONS.COLLECTION_ERROR]: (state, action) => {
      return Object.assign({}, state, {
        error: action.data.message,
      });
    },

    [ACTIONS.COLLECTION_ITEMS_RESOLVE_STARTED]: (state, action) => {
      const { ids } = action.data;
      const { isResolvingCollectionById } = state;
      const newResolving = Object.assign({}, isResolvingCollectionById);
      ids.forEach(id => {
        newResolving[id] = true;
      });
      return Object.assign({}, state, {
        ...state,
        error: '',
        isResolvingCollectionById: newResolving,
      });
    },
    [ACTIONS.USER_STATE_POPULATE]: (state, action) => {
      const { builtinCollectionTest, savedCollectionTest, unpublishedCollectionTest } = action.data;
      return {
        ...state,
        unpublished: unpublishedCollectionTest || state.unpublished,
        builtin: builtinCollectionTest || state.builtin,
        saved: savedCollectionTest || state.saved,
      };
    },
    [ACTIONS.COLLECTION_ITEMS_RESOLVE_COMPLETED]: (state, action) => {
      const { resolvedCollections, failedCollectionIds } = action.data;
      const { pending, edited, isResolvingCollectionById, resolved } = state;
      const newPending = Object.assign({}, pending);
      const newEdited = Object.assign({}, edited);
      const newResolved = Object.assign({}, resolved, resolvedCollections);

      const resolvedIds = Object.keys(resolvedCollections);
      const newResolving = Object.assign({}, isResolvingCollectionById);
      if (resolvedCollections && Object.keys(resolvedCollections).length) {
        resolvedIds.forEach(resolvedId => {
          if (newEdited[resolvedId]) {
            if (newEdited[resolvedId]['updatedAt'] < resolvedCollections[resolvedId]['updatedAt']) {
              delete newEdited[resolvedId];
            }
          }
          delete newResolving[resolvedId];
          if (newPending[resolvedId]) {
            delete newPending[resolvedId];
          }
        });
      }

      if (failedCollectionIds && Object.keys(failedCollectionIds).length) {
        failedCollectionIds.forEach(failedId => {
          delete newResolving[failedId];
        });
      }

      return Object.assign({}, state, {
        ...state,
        pending: newPending,
        resolved: newResolved,
        edited: newEdited,
        isResolvingCollectionById: newResolving,
      });
    },
    [ACTIONS.COLLECTION_ITEMS_RESOLVE_FAILED]: (state, action) => {
      const { ids } = action.data;
      const { isResolvingCollectionById } = state;
      const newResolving = Object.assign({}, isResolvingCollectionById);
      ids.forEach(id => {
        delete newResolving[id];
      });
      return Object.assign({}, state, {
        ...state,
        isResolvingCollectionById: newResolving,
        error: action.data.message,
      });
    },
  },
  defaultState
);

export { collectionsReducer };