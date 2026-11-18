// The data of the quiz of a visitor ("Můj Detail dne", src/lib/my-quiz.ts and src/lib/my-quiz-editor.ts): the works in the game, the
// works alike each of them, the places the game picked and the places kept out (quizPageData of src/lib/detail-game-works.ts).
import { quizPageData } from '../../../lib/detail-game-works';

export async function GET() {
  return new Response(JSON.stringify(await quizPageData()), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
