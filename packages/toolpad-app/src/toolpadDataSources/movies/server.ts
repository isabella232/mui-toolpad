import moviesData from '../../../movies.json';
import { LegacyConnection, ApiResult, ServerDataSource } from '../../types';
import { MoviesConnectionParams, MoviesQuery, Movie } from './types';

async function exec(
  connection: LegacyConnection<MoviesConnectionParams>,
  moviesQuery: MoviesQuery,
): Promise<ApiResult<Movie[]>> {
  const data = moviesData.movies.filter((movie) =>
    moviesQuery.genre ? movie.genres.includes(moviesQuery.genre) : true,
  );
  return {
    data,
  };
}

const dataSource: ServerDataSource<MoviesConnectionParams, MoviesQuery, Movie[]> = {
  exec,
};

export default dataSource;
