// queries/part2_queries.js
// Запуск (з кореня репозиторію):
//   source .env
//   mongosh "$MONGO_URI" --file queries/part2_queries.js

db = db.getSiblingDB("spotify");

function section(title) {
  print("\n" + "=".repeat(70));
  print(title);
  print("=".repeat(70));
}

section("Завдання 1. Треки для вечірки");

const partyFilter = {
  "audio_features.danceability": { $gt: 0.7 },
  "audio_features.energy": { $gt: 0.7 },
  duration_ms: { $gte: 180000, $lte: 300000 }
};

print("Знайдено треків: " + db.tracks.countDocuments(partyFilter));
print("Топ-10 за популярністю:");
printjson(
  db.tracks
    .find(partyFilter, {
      _id: 0,
      track_name: 1,
      artists: 1,
      popularity: 1,
      duration_sec: 1,
      "audio_features.danceability": 1,
      "audio_features.energy": 1
    })
    .sort({ popularity: -1, track_name: 1 })
    .limit(10)
    .toArray()
);


section("Завдання 2. Виконавці, у яких усі треки популярні");

printjson(
  db.tracks.aggregate([
    // один документ на унікальний трек
    {
      $group: {
        _id: "$track_id",
        artists: { $first: "$artists" },
        popularity: { $max: "$popularity" }
      }
    },
    // по одному документу на пару (трек, виконавець)
    { $unwind: "$artists" },
    {
      $group: {
        _id: "$artists",
        tracks_count: { $sum: 1 },
        min_popularity: { $min: "$popularity" },
        avg_popularity: { $avg: "$popularity" }
      }
    },
    { $match: { tracks_count: { $gte: 3 }, min_popularity: { $gte: 60 } } },
    { $sort: { avg_popularity: -1, tracks_count: -1, _id: 1 } },
    { $limit: 20 },
    {
      $project: {
        _id: 0,
        artist: "$_id",
        tracks_count: 1,
        min_popularity: 1,
        avg_popularity: { $round: ["$avg_popularity", 1] }
      }
    }
  ]).toArray()
);


section("Завдання 3. Нетипові треки (темп вищий за avg + 2*stdDev жанру)");

const outliers = db.tracks.aggregate([
  {
    $group: {
      _id: "$track_genre",
      avg_tempo: { $avg: "$audio_features.tempo" },
      std_tempo: { $stdDevPop: "$audio_features.tempo" },
      tracks: {
        $push: {
          _id: "$_id",
          track_name: "$track_name",
          popularity: "$popularity",
          artists: "$artists",
          audio_features: { tempo: "$audio_features.tempo" }
        }
      }
    }
  },
  {
    $addFields: {
      outlier_threshold: {
        $add: ["$avg_tempo", { $multiply: [2, "$std_tempo"] }]
      }
    }
  },
  {
    $addFields: {
      outlier_tracks: {
        $filter: {
          input: "$tracks",
          as: "t",
          cond: { $gt: ["$$t.audio_features.tempo", "$outlier_threshold"] }
        }
      }
    }
  },
  {
    $project: {
      _id: 0,
      genre: "$_id",
      avg_tempo: { $round: ["$avg_tempo", 1] },
      outlier_threshold: { $round: ["$outlier_threshold", 1] },
      outlier_tracks: "$outlier_tracks"
    }
  },
  { $sort: { genre: 1 } }
]).toArray();

const withOutliers = outliers.filter(g => g.outlier_tracks.length > 0);
print("Жанрів усього: " + outliers.length);
print("Жанрів із нетиповими треками: " + withOutliers.length);
print("Нетипових треків усього: " +
  outliers.reduce((sum, g) => sum + g.outlier_tracks.length, 0));
print("\nПриклад: жанр acoustic");
printjson(outliers.find(g => g.genre === "acoustic"));
print("\nУсі жанри (коротко):");
outliers.forEach(g =>
  print(
    g.genre.padEnd(20) +
    " avg=" + String(g.avg_tempo).padEnd(6) +
    " threshold=" + String(g.outlier_threshold).padEnd(7) +
    " outliers=" + g.outlier_tracks.length
  )
);

section("Завдання 4. Треки для фонової роботи");

const workFilter = {
  "audio_features.loudness": { $lt: -10 },
  "audio_features.speechiness": { $lt: 0.1 },
  "audio_features.instrumentalness": { $gt: 0.5 },
  explicit: false
};

print("Знайдено треків: " + db.tracks.countDocuments(workFilter));
print("Топ-10 за популярністю:");
printjson(
  db.tracks
    .find(workFilter, {
      _id: 0,
      track_name: 1,
      artists: 1,
      popularity: 1,
      explicit: 1,
      "audio_features.loudness": 1,
      "audio_features.speechiness": 1,
      "audio_features.instrumentalness": 1
    })
    .sort({ popularity: -1, track_name: 1 })
    .limit(10)
    .toArray()
);
