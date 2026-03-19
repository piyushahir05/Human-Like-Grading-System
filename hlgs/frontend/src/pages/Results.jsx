import { useParams } from 'react-router-dom'

export default function Results() {
  const { id } = useParams()
  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="font-['DM_Serif_Display'] text-3xl text-white">Result #{id}</h1>
    </main>
  )
}
